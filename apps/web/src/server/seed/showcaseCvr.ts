import { buildCvr, type Cvr } from "../results/cvr";
import { seedReceipt, type SeedPoll } from "./insert";
import { showcasePolls } from "./showcase";

/** A showcase poll as the seed writes it. Options and ballots never depend on the seeding date. */
export function showcasePoll(slug: string): SeedPoll {
  const spec = showcasePolls(new Date(0)).find((p) => p.slug === slug);
  if (!spec) throw new Error(`no showcase poll ${slug}`);
  return spec;
}

/**
 * The cast-vote record a seeded showcase poll serves, worked out from the seed
 * alone: the same receipts in the same order through the same CVR code, so the
 * CSV and its SHA-256 equal what /api/v1/polls/<slug>/cvr?format=csv answers.
 */
export function showcaseCvr(slug: string): Cvr {
  const spec = showcasePoll(slug);
  const options = spec.options.map((label) => ({ id: label, label }));
  const ballots = spec.ballots.map((ranking, i) => ({ ranking, receipt: seedReceipt(slug, i) }));
  ballots.sort((a, b) => (a.receipt < b.receipt ? -1 : 1));
  return buildCvr(options, ballots, spec.maxRanks);
}
