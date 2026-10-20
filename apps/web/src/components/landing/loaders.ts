import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { pairwise, type ElectionDataset, type Golden } from "@recount/engine";
import { cacheLife } from "next/cache";
import { ELECTIONS_DIR, getElection, listElections } from "@/server/elections";
import { buildApiExample } from "./apiExample";
import { buildAudit } from "./auditData";
import { buildHeroData } from "./heroData";
import { buildLesson } from "./lessonData";
import { buildReplayRow } from "./replaysData";

/*
 * Everything the landing prints is counted here while the page is built, from the
 * same datasets, goldens and seed the API serves. Cached for the life of the
 * deployment: none of it can change without a new build.
 */

export const HERO_SLUG = "nyc-2025-dem-mayor";

/** The engine builds some records with Object.create(null); a cache entry must be plain data. */
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export async function getHero() {
  "use cache";
  cacheLife("max");
  const entry = (await listElections()).find((e) => e.slug === HERO_SLUG);
  if (!entry?.golden) throw new Error(`${HERO_SLUG} has no golden`);
  const golden = JSON.parse(await readFile(join(ELECTIONS_DIR, entry.golden.file), "utf8")) as Golden;
  return plain(buildHeroData(await getElection(HERO_SLUG), golden, `/elections/${HERO_SLUG}`));
}

export async function getLesson() {
  "use cache";
  cacheLife("max");
  return plain(buildLesson());
}

export async function getAudit() {
  "use cache";
  cacheLife("max");
  return plain(buildAudit());
}

export async function getApiExample() {
  "use cache";
  cacheLife("max");
  return plain(buildApiExample());
}

async function condorcetOf(file: string): Promise<string | null> {
  const raw = await readFile(join(ELECTIONS_DIR, file));
  const dataset = JSON.parse((file.endsWith(".gz") ? gunzipSync(raw) : raw).toString("utf8")) as ElectionDataset;
  const id = pairwise(dataset.candidates, dataset.ballots).condorcetWinner;
  return id === null ? null : (dataset.candidates.find((c) => c.id === id)?.name ?? id);
}

export async function getReplays() {
  "use cache";
  cacheLife("max");
  const entries = await listElections();
  const rows = await Promise.all(
    entries.map(async (entry) => {
      const replay = await getElection(entry.slug);
      return buildReplayRow(replay, replay.seats === 1 ? await condorcetOf(entry.file) : null);
    }),
  );
  return plain(rows);
}
