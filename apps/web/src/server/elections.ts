import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import {
  compareToGolden,
  presetRules,
  tabulate,
  type DatasetSource,
  type ElectionDataset,
  type GoldenComparison,
  type Golden,
  type ReportConvention,
  type Rules,
} from "@recount/engine";
import { DomainError } from "./errors";
import { serializeRounds, type ResultRound } from "./results/serialize";

export type ElectionSummary = {
  slug: string;
  title: string;
  file: string;
  bytes: number;
  sha256: string;
  ballots: number;
  patterns: number;
  presetId: string;
  source: DatasetSource;
  golden: { file: string; sha256: string } | null;
};

export type ElectionReplay = {
  slug: string;
  title: string;
  jurisdiction: string;
  date: string;
  office: string;
  seats: number;
  presetId: string;
  datasetSha256: string;
  source: DatasetSource;
  reportConvention: ReportConvention;
  candidates: string[];
  totalBallots: number;
  undervotes: number;
  rounds: ResultRound[];
  winners: string[];
  rules: Rules;
  golden: Omit<Golden, "rounds" | "winners" | "slug"> | null;
  /** Every number the official report prints, compared cell by cell. */
  comparison: (GoldenComparison & { matches: boolean }) | null;
};

/** Read from disk at runtime; next.config traces public/elections into these routes. */
export const ELECTIONS_DIR = join(process.cwd(), "public", "elections");

const manifests = new Map<string, Promise<ElectionSummary[]>>();
const replays = new Map<string, Promise<ElectionReplay>>();

async function readManifest(dir: string): Promise<ElectionSummary[]> {
  const text = await readFile(join(dir, "manifest.json"), "utf8");
  return (JSON.parse(text) as { datasets: ElectionSummary[] }).datasets;
}

export function listElections(dir: string = ELECTIONS_DIR): Promise<ElectionSummary[]> {
  let manifest = manifests.get(dir);
  if (!manifest) {
    manifest = readManifest(dir);
    manifests.set(dir, manifest);
    manifest.catch(() => manifests.delete(dir));
  }
  return manifest;
}

/** The dataset file, checked against its manifest hash. */
export async function loadDataset(dir: string, entry: ElectionSummary): Promise<{ dataset: ElectionDataset; sha256: string }> {
  const raw = await readFile(join(dir, entry.file));
  const sha256 = createHash("sha256").update(raw).digest("hex");
  if (sha256 !== entry.sha256) throw new Error(`dataset ${entry.slug} does not match its manifest hash`);
  const text = entry.file.endsWith(".gz") ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
  return { dataset: JSON.parse(text) as ElectionDataset, sha256 };
}

/** The official round results transcribed for this election, if any. */
export async function loadGolden(dir: string, entry: ElectionSummary): Promise<Golden | null> {
  return entry.golden ? (JSON.parse(await readFile(join(dir, entry.golden.file), "utf8")) as Golden) : null;
}

async function replay(dir: string, entry: ElectionSummary): Promise<ElectionReplay> {
  const { dataset, sha256 } = await loadDataset(dir, entry);
  const golden = await loadGolden(dir, entry);

  const rules = presetRules(dataset.presetId, dataset.seats);
  const result = tabulate({ candidates: dataset.candidates, ballots: dataset.ballots, rules });
  const names = new Map(dataset.candidates.map((c) => [c.id, c.name]));
  const nameOf = (id: string) => names.get(id) ?? id;
  const comparison = golden ? compareToGolden(result, dataset, golden) : null;

  return {
    slug: dataset.slug,
    title: dataset.title,
    jurisdiction: dataset.jurisdiction,
    date: dataset.date,
    office: dataset.office,
    seats: dataset.seats,
    presetId: dataset.presetId,
    datasetSha256: sha256,
    source: dataset.source,
    reportConvention: dataset.reportConvention,
    candidates: dataset.candidates.filter((c) => !c.countsOnlyForOvervote).map((c) => c.name),
    totalBallots: result.totalBallots,
    undervotes: result.undervotes,
    rounds: serializeRounds(result, nameOf),
    winners: result.winners.map(nameOf),
    rules,
    golden: golden
      ? {
          sourceUrl: golden.sourceUrl,
          reportSha256: golden.reportSha256,
          retrievedAt: golden.retrievedAt,
          ...(golden.transcribedFrom ? { transcribedFrom: golden.transcribedFrom } : {}),
          ...(golden.reportParts ? { reportParts: golden.reportParts } : {}),
          ...(golden.notes ? { notes: golden.notes } : {}),
        }
      : null,
    comparison: comparison ? { ...comparison, matches: comparison.mismatches.length === 0 } : null,
  };
}

/** Replays are counted once per server instance and kept. */
export async function getElection(slug: string, dir: string = ELECTIONS_DIR): Promise<ElectionReplay> {
  const entry = (await listElections(dir)).find((e) => e.slug === slug);
  if (!entry) throw new DomainError("not_found");
  const key = `${dir}\n${slug}`;
  let pending = replays.get(key);
  if (!pending) {
    pending = replay(dir, entry);
    replays.set(key, pending);
    pending.catch(() => replays.delete(key));
  }
  return pending;
}
