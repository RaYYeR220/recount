// Decides, for every open saboteur pull request, which gate caught the planted
// bug. Waits until each gate the mutant is expected to meet has finished (or
// the pull request is older than TIMEOUT_HOURS), records the verdict as a
// comment with a machine-readable copy for /quality, then closes it.
import { readFileSync } from "node:fs";

const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
const GATES = ["ci", "preflight", "TestSprite V3"];
const TIMEOUT_HOURS = 6;
const MARKER = "saboteur-verdict";

async function gh(path, init = {}) {
  const res = await fetch(`https://api.github.com/${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      ...init.headers,
    },
  });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

const post = (path, body, method = "POST") =>
  gh(path, { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });

function outcome(conclusion) {
  if (conclusion === "success") return "success";
  if (conclusion === "failure" || conclusion === "timed_out" || conclusion === "error") return "failure";
  return conclusion ?? "pending";
}

/** Latest state of each gate on a commit, from check runs and commit statuses alike. */
async function gates(sha) {
  const found = {};
  const { check_runs } = await gh(`repos/${repo}/commits/${sha}/check-runs?per_page=100`);
  for (const run of check_runs) {
    if (!GATES.includes(run.name)) continue;
    const state = run.status === "completed" ? outcome(run.conclusion) : "pending";
    found[run.name] = { state, at: run.completed_at ?? run.started_at, url: run.html_url, jobId: run.id };
  }
  const { statuses } = await gh(`repos/${repo}/commits/${sha}/status`);
  for (const s of statuses) {
    if (!GATES.includes(s.context)) continue;
    found[s.context] = { state: outcome(s.state), at: s.updated_at, url: s.target_url, detail: s.description };
  }
  return found;
}

/** The step a failed Actions job stopped at. Check run ids are job ids. */
async function failedStep(gate) {
  if (!gate.jobId) return gate.detail ?? null;
  const job = await gh(`repos/${repo}/actions/jobs/${gate.jobId}`).catch(() => null);
  return job?.steps?.find((step) => step.conclusion === "failure")?.name ?? null;
}

function cell(name, gate, expected) {
  if (!gate) return expected ? "did not report" : "not run for this layer";
  if (gate.state === "failure") return `**caught it**${gate.step ? ` at “${gate.step}”` : ""}`;
  if (gate.state === "success") return "passed";
  return gate.state;
}

const pulls = await gh(`repos/${repo}/pulls?state=open&per_page=100`);
for (const pr of pulls) {
  if (!pr.labels.some((label) => label.name === "saboteur")) continue;
  const id = /^saboteur\/(m\d+-[a-z0-9-]+)-\d+$/.exec(pr.head.ref)?.[1];
  if (!id) continue;
  const meta = JSON.parse(readFileSync(`mutants/${id}/meta.json`, "utf8"));
  const expected = meta.gates ?? ["ci"];

  const found = await gates(pr.head.sha);
  const ageHours = (Date.now() - Date.parse(pr.created_at)) / 3_600_000;
  const settled = expected.every((name) => found[name] && found[name].state !== "pending");
  if (!settled && ageHours < TIMEOUT_HOURS) {
    console.log(`${id}: waiting (${JSON.stringify(Object.fromEntries(Object.entries(found).map(([k, v]) => [k, v.state])))})`);
    continue;
  }

  for (const gate of Object.values(found)) if (gate.state === "failure") gate.step = await failedStep(gate);
  const failed = Object.entries(found)
    .filter(([, gate]) => gate.state === "failure")
    .sort(([, a], [, b]) => Date.parse(a.at) - Date.parse(b.at));
  const killedBy = failed[0]?.[0] ?? null;
  const control = meta.layer === "control";
  const verdict = control
    ? killedBy ? "control failed" : "control passed"
    : killedBy ? "killed" : settled ? "survived" : "timed out";

  const headline = {
    killed: `Saboteur verdict: caught by \`${killedBy}\``,
    survived: "Saboteur verdict: **survived every gate**",
    "timed out": "Saboteur verdict: timed out before every gate reported",
    "control passed": "Saboteur verdict: control change, every gate stayed green",
    "control failed": `Saboteur verdict: **control change failed \`${killedBy}\`** (a flaky or over-strict gate)`,
  }[verdict];
  const record = {
    mutant: id,
    layer: meta.layer,
    bug: meta.bug,
    verdict,
    killedBy,
    expectedKiller: meta.expectedKiller,
    gates: Object.fromEntries(GATES.map((name) => [name, found[name] ? { state: found[name].state, step: found[name].step ?? null } : null])),
    sha: pr.head.sha,
    pr: pr.number,
    at: new Date().toISOString(),
  };
  const body = [
    `### ${headline}`,
    "",
    "| Gate | Result |",
    "|---|---|",
    ...GATES.map((name) => `| ${found[name]?.url ? `[${name}](${found[name].url})` : name} | ${cell(name, found[name], expected.includes(name))} |`),
    "",
    `Planted bug (\`${id}\`, ${meta.layer}): ${meta.bug}`,
    `Expected to be caught by: ${meta.expectedKiller}.`,
    "",
    `<!-- ${MARKER} ${JSON.stringify(record)} -->`,
  ].join("\n");

  await post(`repos/${repo}/issues/${pr.number}/comments`, { body });
  await post(`repos/${repo}/pulls/${pr.number}`, { state: "closed" }, "PATCH");
  await gh(`repos/${repo}/git/refs/heads/${pr.head.ref}`, { method: "DELETE" }).catch(() => {});
  console.log(`${id}: ${verdict}${killedBy ? ` by ${killedBy}` : ""}`);
}
