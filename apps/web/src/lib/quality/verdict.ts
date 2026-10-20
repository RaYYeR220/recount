/**
 * The saboteur's verdict comments and the merge gates' states on a commit, read from
 * GitHub's REST API. Pure parsing; src/lib/quality/github.ts does the fetching.
 */

export const GATES = ["ci", "preflight", "TestSprite V3"] as const;
export type GateName = (typeof GATES)[number];

export const VERDICTS = ["killed", "survived", "timed out", "control passed", "control failed"] as const;
export type VerdictKind = (typeof VERDICTS)[number];

export type GateResult = { state: string; step: string | null };

/** The machine-readable record .github/scripts/saboteur-verdict.mjs leaves in its comment. */
export type Verdict = {
  mutant: string;
  layer: string;
  bug: string;
  verdict: VerdictKind;
  killedBy: string | null;
  expectedKiller: string;
  gates: Record<GateName, GateResult | null>;
  sha: string;
  pr: number;
  at: string;
};

const MARKER = /<!--\s*saboteur-verdict\s+([\s\S]*?)\s*-->/;

const isText = (v: unknown): v is string => typeof v === "string" && v.length > 0;

function gateResult(v: unknown): GateResult | null | undefined {
  if (v === null) return null;
  if (!v || typeof v !== "object") return undefined;
  const g = v as Record<string, unknown>;
  if (!isText(g.state)) return undefined;
  if (g.step !== undefined && g.step !== null && typeof g.step !== "string") return undefined;
  return { state: g.state, step: typeof g.step === "string" ? g.step : null };
}

/**
 * The verdict in a comment body, or null when the body has none or it is malformed
 * (bad JSON, a missing field, an unknown verdict): a comment that cannot be read is
 * left out rather than shown wrong.
 */
export function parseVerdictComment(body: string): Verdict | null {
  const match = MARKER.exec(body);
  if (!match) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(match[1]!);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isText(r.mutant) || !/^m\d+-[a-z0-9-]+$/.test(r.mutant)) return null;
  if (!isText(r.layer) || !isText(r.bug) || !isText(r.expectedKiller) || !isText(r.sha) || !isText(r.at)) return null;
  if (!VERDICTS.includes(r.verdict as VerdictKind)) return null;
  if (r.killedBy !== null && !isText(r.killedBy)) return null;
  if (!Number.isInteger(r.pr) || (r.pr as number) <= 0) return null;
  if (Number.isNaN(Date.parse(r.at))) return null;
  if (!r.gates || typeof r.gates !== "object") return null;
  const gates = {} as Record<GateName, GateResult | null>;
  for (const name of GATES) {
    const g = gateResult((r.gates as Record<string, unknown>)[name]);
    if (g === undefined) return null;
    gates[name] = g;
  }
  return {
    mutant: r.mutant,
    layer: r.layer,
    bug: r.bug,
    verdict: r.verdict as VerdictKind,
    killedBy: r.killedBy as string | null,
    expectedKiller: r.expectedKiller,
    gates,
    sha: r.sha,
    pr: r.pr as number,
    at: r.at,
  };
}

export type MutantRuns = { latest: Verdict; runs: number; killed: number };

/** The latest verdict per mutant, with how many runs it has had and how many it was caught in. */
export function latestVerdicts(verdicts: readonly Verdict[]): Map<string, MutantRuns> {
  const out = new Map<string, MutantRuns>();
  for (const v of [...verdicts].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
    const prev = out.get(v.mutant);
    out.set(v.mutant, { latest: v, runs: (prev?.runs ?? 0) + 1, killed: (prev?.killed ?? 0) + (v.verdict === "killed" ? 1 : 0) });
  }
  return out;
}

/** A check run or a commit status as GitHub returns them, trimmed to what the gates need. */
export type CheckRun = { name: string; status: string; conclusion: string | null; html_url?: string | null; completed_at?: string | null; started_at?: string | null };
export type CommitStatus = { context: string; state: string; target_url?: string | null; updated_at?: string | null };

export type GateState = { state: "success" | "failure" | "pending" | string; url: string | null; at: string | null };

function outcome(conclusion: string | null): GateState["state"] {
  if (conclusion === "success") return "success";
  if (conclusion === "failure" || conclusion === "timed_out" || conclusion === "error") return "failure";
  return conclusion ?? "pending";
}

/** Each gate's latest state on a commit, from check runs and commit statuses alike (statuses win, as in the verdict script). */
export function gateStates(checkRuns: readonly CheckRun[], statuses: readonly CommitStatus[]): Record<GateName, GateState | null> {
  const found = Object.fromEntries(GATES.map((g) => [g, null])) as Record<GateName, GateState | null>;
  const isGate = (name: string): name is GateName => (GATES as readonly string[]).includes(name);
  // Both lists arrive newest first; the first entry per gate is its latest state.
  const ran = new Set<string>();
  for (const run of checkRuns) {
    if (!isGate(run.name) || ran.has(run.name)) continue;
    ran.add(run.name);
    found[run.name] = {
      state: run.status === "completed" ? outcome(run.conclusion) : "pending",
      url: run.html_url ?? null,
      at: run.completed_at ?? run.started_at ?? null,
    };
  }
  const seen = new Set<string>();
  for (const s of statuses) {
    if (!isGate(s.context) || seen.has(s.context)) continue;
    seen.add(s.context);
    found[s.context] = { state: outcome(s.state), url: s.target_url ?? null, at: s.updated_at ?? null };
  }
  return found;
}
