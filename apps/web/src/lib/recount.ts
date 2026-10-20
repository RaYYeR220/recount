/**
 * "Recount in your browser": what the page asks the worker to do, what comes back,
 * and how the outcome is held against what the page published.
 */
import type { GoldenMismatch, PresetId } from "@recount/engine";
import type { ResultRound } from "@/server/results/serialize";
import { formatVotes } from "./votes";

export type PollRecountRequest = {
  kind: "poll";
  /** Same-origin URL of the cast-vote record CSV. */
  csvUrl: string;
  presetId: PresetId;
  seats: number;
  maxRanks: number | null;
  /** Option labels in ballot order, as published (options nobody ranked included). */
  candidates: string[];
};

export type ElectionRecountRequest = {
  kind: "election";
  datasetUrl: string;
  goldenUrl: string | null;
};

export type RecountRequest = PollRecountRequest | ElectionRecountRequest;

export type RecountStep = "fetch" | "hash" | "unzip" | "count" | "compare";

export type PollRecount = {
  kind: "poll";
  sha256: string;
  rows: number;
  winners: string[];
  rounds: ResultRound[];
};

export type ElectionRecount = {
  kind: "election";
  sha256: string;
  totalBallots: number;
  /** Winners by their names in the dataset. */
  winners: string[];
  rounds: number;
  /** Figures compared with the official report; null without one. */
  cells: number | null;
  mismatches: GoldenMismatch[];
};

export type RecountResult = PollRecount | ElectionRecount;

export type WorkerMessage =
  | { type: "progress"; step: RecountStep }
  | { type: "done"; result: RecountResult }
  | { type: "error"; message: string };

export const STEP_TEXT: Record<RecountStep, string> = {
  fetch: "Downloading the ballots…",
  hash: "Hashing the exact bytes…",
  unzip: "Unpacking the ballots…",
  count: "Counting every round again…",
  compare: "Comparing with the published figures…",
};

const short = (sha: string) => sha.slice(0, 12);
const rounds = (n: number) => `${n} ${n === 1 ? "round" : "rounds"}`;
const names = (list: readonly string[]) => (list.length ? list.join(", ") : "nobody");

export type PublishedPoll = { sha256: string; winners: string[]; rounds: ResultRound[] };

/** Every way the recount differs from the published result, in words; empty when it matches. */
export function comparePollRecount(published: PublishedPoll, recount: PollRecount): string[] {
  const out: string[] = [];
  if (recount.sha256 !== published.sha256) {
    out.push(`The cast-vote record hashes to ${short(recount.sha256)}…, but the page published ${short(published.sha256)}….`);
  }
  if (names(recount.winners) !== names(published.winners)) {
    out.push(`The recount elects ${names(recount.winners)}; the page published ${names(published.winners)}.`);
  }
  if (recount.rounds.length !== published.rounds.length) {
    out.push(`The recount takes ${rounds(recount.rounds.length)}; the page published ${rounds(published.rounds.length)}.`);
  }
  const shared = Math.min(recount.rounds.length, published.rounds.length);
  for (let i = 0; i < shared; i++) {
    const mine = recount.rounds[i]!.tally;
    const theirs = published.rounds[i]!.tally;
    const option = [...new Set([...Object.keys(theirs), ...Object.keys(mine)])].find((k) => mine[k] !== theirs[k]);
    if (option !== undefined) {
      const fig = (v: string | undefined) => (v === undefined ? "nothing" : formatVotes(v));
      out.push(`Round ${i + 1}, ${option}: the recount has ${fig(mine[option])}, the page published ${fig(theirs[option])}.`);
      break;
    }
  }
  return out;
}

/** "Recount matches: same winner, same 2 rounds, CVR SHA-256 166e8c4536f3". */
export function pollMatchLine(seats: number, recount: PollRecount): string {
  return `Recount matches: same ${seats > 1 ? "winners" : "winner"}, same ${rounds(recount.rounds.length)}, CVR SHA-256 ${short(recount.sha256)}`;
}

/** Largest gap between an official figure and ours, in whole votes (rounded up). */
export function largestGap(mismatches: readonly GoldenMismatch[]): number {
  let gap = 0;
  for (const m of mismatches) {
    const a = Number(m.expected);
    const b = Number(m.actual);
    if (Number.isFinite(a) && Number.isFinite(b)) gap = Math.max(gap, Math.ceil(Math.abs(a - b)));
  }
  return gap;
}

/** "159 of 159 figures match the official count", "17 of 19 figures match the official count". */
export function figuresLine(cells: number, mismatches: number, against = "the official count"): string {
  return `${cells - mismatches} of ${cells} figures match ${against}`;
}

export type PublishedElection = {
  sha256: string;
  winners: string[];
  rounds: number;
  cells: number | null;
  mismatches: number;
  /** What the figures are held against: "the official count" or "the city's published round results". */
  against: string;
};

/** Every way the browser's replay differs from the replay the page published. */
export function compareElectionRecount(published: PublishedElection, recount: ElectionRecount): string[] {
  const out: string[] = [];
  if (recount.sha256 !== published.sha256) {
    out.push(`The ballot file hashes to ${short(recount.sha256)}…, but the page published ${short(published.sha256)}….`);
  }
  if (names(recount.winners) !== names(published.winners)) {
    out.push(`The recount elects ${names(recount.winners)}; the page published ${names(published.winners)}.`);
  }
  if (recount.rounds !== published.rounds) {
    out.push(`The recount takes ${rounds(recount.rounds)}; the page published ${rounds(published.rounds)}.`);
  }
  if (recount.cells !== published.cells || recount.mismatches.length !== published.mismatches) {
    const mine = recount.cells === null ? "no official figures" : figuresLine(recount.cells, recount.mismatches.length, published.against);
    const theirs = published.cells === null ? "no official figures" : figuresLine(published.cells, published.mismatches, published.against);
    out.push(`In this browser ${mine}; the page published ${theirs}.`);
  }
  return out;
}
