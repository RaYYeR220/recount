import type { PollStatus } from "@/server/polls/status";
import type { PresetId } from "@/server/polls/schema";

/** Words for a poll's settings, shared by the dashboard, the wizard and the manage page. */

export type AccessMode = "link" | "codes";
export type ResultsVisibility = "live" | "after_close" | "owner_only";

export const STATUS_LABEL: Record<PollStatus, string> = {
  scheduled: "Scheduled",
  open: "Open",
  closed: "Closed",
};

export const ACCESS_LABEL: Record<AccessMode, string> = {
  link: "Anyone with the link",
  codes: "Invite codes",
};

export const ACCESS_DETAIL: Record<AccessMode, string> = {
  link: "One ballot per browser. Share one link with everyone.",
  codes: "One ballot per code. You hand out a code to each voter.",
};

/** Short form for tables. */
export const RESULTS_LABEL: Record<ResultsVisibility, string> = {
  live: "Live",
  after_close: "After close",
  owner_only: "Only you",
};

export const RESULTS_LONG: Record<ResultsVisibility, string> = {
  live: "Live while voting",
  after_close: "After the poll closes",
  owner_only: "Only you",
};

export const RESULTS_DETAIL: Record<ResultsVisibility, string> = {
  live: "Anyone with the link can watch the count as ballots come in.",
  after_close: "Results stay hidden until voting ends, then anyone with the link can see them.",
  owner_only: "Only you see the results. To everyone else they don't exist.",
};

/** "One winner" or "STV, 3 seats". */
export function methodLabel(seats: number): string {
  return seats === 1 ? "One winner" : `STV, ${seats} seats`;
}

/** "One winner, instant runoff" or "3 seats, single transferable vote". */
export function methodLong(seats: number): string {
  return seats === 1 ? "One winner, instant runoff" : `${seats} seats, single transferable vote`;
}

export type PresetInfo = {
  id: PresetId;
  name: string;
  /** One plain sentence for the organizer. */
  sentence: string;
  /** Rankings the jurisdiction allows; the wizard offers it as the ballot's limit. */
  maxRanks: number | null;
  seats: "one" | "many" | "any";
};

export const PRESETS: readonly PresetInfo[] = [
  {
    id: "recount-standard",
    name: "Recount standard",
    sentence: "Every ranking counts, and a tie goes to whoever led in the earlier rounds, then to a draw anyone can repeat.",
    maxRanks: null,
    seats: "any",
  },
  {
    id: "nyc",
    name: "New York City",
    sentence: "The rules of New York City's primaries: five rankings, counted down to the final two.",
    maxRanks: 5,
    seats: "one",
  },
  {
    id: "minneapolis-irv",
    name: "Minneapolis",
    sentence: "The rules of Minneapolis's mayoral race: three rankings, and everyone who can no longer win is dropped at once.",
    maxRanks: 3,
    seats: "one",
  },
  {
    id: "portland-stv",
    name: "Portland",
    sentence: "The rules of Portland's council races: six rankings, with surplus votes passed on in fractions.",
    maxRanks: 6,
    seats: "many",
  },
];

export function presetInfo(id: string): PresetInfo | undefined {
  return PRESETS.find((p) => p.id === id);
}

/** Whether a preset can count a poll with this many seats, and if not, why. */
export function presetFits(preset: PresetInfo, seats: number): { ok: true } | { ok: false; reason: string } {
  if (preset.seats === "one" && seats !== 1) return { ok: false, reason: "For one winner only" };
  if (preset.seats === "many" && seats < 2) return { ok: false, reason: "For two or more seats" };
  return { ok: true };
}

/** "Showing 1–20 of 120 polls", with an en dash; "Showing 1–1 of 1 poll". */
export function showingText(page: number, pageSize: number, onPage: number, total: number): string {
  const first = (page - 1) * pageSize + 1;
  const last = first + onPage - 1;
  return `Showing ${first}–${last} of ${total.toLocaleString("en-US")} ${total === 1 ? "poll" : "polls"}`;
}

/** "1 ballot", "1,204 ballots". */
export function ballotsText(n: number): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? "ballot" : "ballots"}`;
}

/** "2 options", "1 option". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}
