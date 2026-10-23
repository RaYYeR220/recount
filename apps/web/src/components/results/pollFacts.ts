import { presetLabel } from "@/lib/presetNames";
import { formatCount } from "@/lib/votes";

type PollFactsInput = {
  status: "scheduled" | "open" | "closed";
  timeZone: string;
  opensAt: Date | null;
  closesAt: Date | null;
  /** When it stopped taking ballots, for a closed poll. */
  closedAt: Date | null;
  seats: number;
  presetId: string;
  ballots: number;
  resultsVisibility: "live" | "after_close" | "owner_only";
};

/** "October 11, 2026 (Europe/Warsaw)": the date in the poll's own zone, with the zone named. */
export function dateInZone(date: Date, timeZone: string): string {
  const day = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "long", day: "numeric" }).format(date);
  return `${day} (${timeZone})`;
}

const VISIBILITY = { live: "Results: live", after_close: "Results: after close", owner_only: "Results: organiser only" } as const;

/** The badges under a results page title. */
export function pollFacts(p: PollFactsInput): string[] {
  const when =
    p.status === "closed" && p.closedAt
      ? `Closed ${dateInZone(p.closedAt, p.timeZone)}`
      : p.status === "scheduled" && p.opensAt
        ? `Opens ${dateInZone(p.opensAt, p.timeZone)}`
        : p.closesAt
          ? `Open until ${dateInZone(p.closesAt, p.timeZone)}`
          : "Open";
  return [
    when,
    p.seats > 1 ? `Single transferable vote, ${p.seats} seats` : "One winner, instant runoff",
    `${formatCount(p.ballots)} ${p.ballots === 1 ? "ballot" : "ballots"}`,
    `${presetLabel(p.presetId)} rules`,
    // Once the poll closes, live and after-close results are the same thing: public.
    p.status === "closed" && p.resultsVisibility !== "owner_only" ? "Results: public" : VISIBILITY[p.resultsVisibility],
  ];
}
