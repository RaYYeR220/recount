import { formatReceipt } from "@/server/ballots/receipt";
import { tabulatePoll, type CountedResults } from "@/server/results/tabulatePoll";
import { seedReceipt } from "@/server/seed/insert";
import { showcaseCvr, showcasePoll } from "@/server/seed/showcaseCvr";

export type CountedPoll = { slug: string; title: string; options: string[]; results: CountedResults };

/** A seeded poll counted the way its results page counts it. */
export function countShowcase(slug: string): CountedPoll {
  const spec = showcasePoll(slug);
  const { results } = tabulatePoll(spec, showcaseCvr(slug), null);
  return { slug, title: spec.title, options: spec.options, results };
}

export type LessonData = {
  /** One winner, 13 ballots: plurality and ranked choice disagree. */
  lunch: CountedPoll;
  /** Two seats, a fractional surplus. */
  committee: CountedPoll;
  /** The open demo poll, for the four little screens. */
  offsite: CountedPoll & { receipt: string; ranking: string[] };
};

export function buildLesson(): LessonData {
  const offsite = countShowcase("offsite-2026");
  const first = showcasePoll("offsite-2026").ballots[0]!;
  return {
    lunch: countShowcase("lunch-closed"),
    committee: countShowcase("committee-2026"),
    // A real receipt from the seed: it looks the ballot up on the poll's verify page.
    offsite: { ...offsite, receipt: formatReceipt(seedReceipt("offsite-2026", 0)), ranking: first },
  };
}
