import { cacheLife } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { REPOSITORY_URL } from "@/components/shell/SiteFooter";
import { gateStates, parseVerdictComment, type CheckRun, type CommitStatus, type GateName, type GateState, type Verdict } from "./verdict";

/** "RaYYeR220/recount" */
export const REPOSITORY = new URL(REPOSITORY_URL).pathname.replace(/^\/|\/$/g, "");

type Fetched<T> = { ok: true; data: T } | { ok: false; status: number; rateLimited: boolean };

/** One REST call; GITHUB_TOKEN, when set, lifts the anonymous limit of 60 calls an hour. */
async function gh<T>(path: string): Promise<Fetched<T>> {
  const token = process.env.GITHUB_TOKEN;
  const res = await fetch(`https://api.github.com/${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "recount-quality",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return { ok: false, status: res.status, rateLimited: res.headers.get("x-ratelimit-remaining") === "0" };
  return { ok: true, data: (await res.json()) as T };
}

function reason(failed: { status: number; rateLimited: boolean }): string {
  if (failed.rateLimited || failed.status === 429) return "GitHub's API limit for this server is used up for the hour.";
  if (failed.status === 404) return `GitHub answers 404 for ${REPOSITORY}: the repository is not public yet.`;
  if (failed.status === 401 || failed.status === 403) return `GitHub answers ${failed.status} for ${REPOSITORY}: this server cannot read it.`;
  return `GitHub answered ${failed.status}.`;
}

export type Unavailable = { kind: "unavailable"; reason: string; checkedAt: string };

export type PullGates = {
  number: number;
  title: string;
  url: string;
  state: "open" | "closed" | "merged";
  saboteur: boolean;
  updatedAt: string;
  gates: Record<GateName, GateState | null>;
};

export type GateHistory = { kind: "ok"; pulls: PullGates[]; checkedAt: string } | Unavailable;

type Pull = {
  number: number;
  title: string;
  html_url: string;
  state: "open" | "closed";
  merged_at: string | null;
  updated_at: string;
  head: { sha: string };
  labels: Array<{ name: string }>;
};

const PULLS = 12;

/**
 * The gates on the most recent pull requests: ci and preflight check runs and the
 * TestSprite V3 status on each head commit. Regenerated every five minutes; when
 * GitHub can't be read the page says so instead of showing anything made up.
 */
export async function getGateHistory(): Promise<GateHistory> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  const checkedAt = new Date().toISOString();
  try {
    const pulls = await gh<Pull[]>(`repos/${REPOSITORY}/pulls?state=all&sort=updated&direction=desc&per_page=${PULLS}`);
    if (!pulls.ok) return { kind: "unavailable", reason: reason(pulls), checkedAt };
    const rows = await Promise.all(
      pulls.data.map(async (pr): Promise<PullGates> => {
        const [runs, statuses] = await Promise.all([
          gh<{ check_runs: CheckRun[] }>(`repos/${REPOSITORY}/commits/${pr.head.sha}/check-runs?per_page=100`),
          gh<{ statuses: CommitStatus[] }>(`repos/${REPOSITORY}/commits/${pr.head.sha}/status`),
        ]);
        return {
          number: pr.number,
          title: pr.title,
          url: pr.html_url,
          state: pr.merged_at ? "merged" : pr.state,
          saboteur: pr.labels.some((l) => l.name === "saboteur"),
          updatedAt: pr.updated_at,
          gates: gateStates(runs.ok ? runs.data.check_runs : [], statuses.ok ? statuses.data.statuses : []),
        };
      }),
    );
    return { kind: "ok", pulls: rows.filter((r) => Object.values(r.gates).some((g) => g !== null)), checkedAt };
  } catch (error) {
    unstable_rethrow(error);
    return { kind: "unavailable", reason: "GitHub could not be reached from this server.", checkedAt };
  }
}

export type VerdictFeed = { kind: "ok"; verdicts: Verdict[]; checkedAt: string } | Unavailable;

type Issue = { number: number; pull_request?: unknown };
type Comment = { body?: string | null };

/** Verdict comments on closed pull requests labelled saboteur, newest pull requests first. */
export async function getVerdicts(): Promise<VerdictFeed> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  const checkedAt = new Date().toISOString();
  try {
    const issues = await gh<Issue[]>(`repos/${REPOSITORY}/issues?labels=saboteur&state=closed&sort=updated&direction=desc&per_page=30`);
    if (!issues.ok) return { kind: "unavailable", reason: reason(issues), checkedAt };
    const lists = await Promise.all(
      issues.data
        .filter((i) => i.pull_request)
        .map(async (i) => {
          const comments = await gh<Comment[]>(`repos/${REPOSITORY}/issues/${i.number}/comments?per_page=100`);
          return comments.ok ? comments.data.map((c) => parseVerdictComment(c.body ?? "")).filter((v): v is Verdict => v !== null) : [];
        }),
    );
    return { kind: "ok", verdicts: lists.flat(), checkedAt };
  } catch (error) {
    unstable_rethrow(error);
    return { kind: "unavailable", reason: "GitHub could not be reached from this server.", checkedAt };
  }
}
