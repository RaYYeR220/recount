// Vercel's ignored build step: exit 0 skips the deployment, exit 1 builds it.
// A saboteur branch only deploys when its mutant is meant to meet the gates that
// test the deployed app; every other branch always builds.
import { existsSync, readFileSync } from "node:fs";

const match = /^(?:sab\/(m\d+-[a-z0-9-]+)|saboteur\/(m\d+-[a-z0-9-]+)-\d+)$/.exec(process.env.VERCEL_GIT_COMMIT_REF ?? "");
const id = match?.[1] ?? match?.[2];
if (!id) process.exit(1);

const meta = new URL(`../../../mutants/${id}/meta.json`, import.meta.url);
const gates = existsSync(meta) ? (JSON.parse(readFileSync(meta, "utf8")).gates ?? []) : [];
process.exit(gates.includes("preflight") ? 1 : 0);
