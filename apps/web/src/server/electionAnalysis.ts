import { pairwise, pluralityWinner, type GoldenRound, type PairwiseResult } from "@recount/engine";
import { DomainError } from "./errors";
import { ELECTIONS_DIR, listElections, loadDataset, loadGolden } from "./elections";

/**
 * What a replay page shows beside the count itself: the head-to-head matrix, the
 * plurality winner and the official figures cell by cell. Everything is keyed by
 * candidate name, like the replay's rounds.
 */
export type ElectionAnalysis = {
  slug: string;
  /** Candidates who can receive votes, in dataset order. */
  contenders: string[];
  /** Undeclared write-ins among them. */
  writeIns: string[];
  pairwise: PairwiseResult;
  pluralityWinner: string | null;
  /** Official round results as transcribed; null without a report. */
  official: { rounds: GoldenRound[]; winners: string[] } | null;
};

const analyses = new Map<string, Promise<ElectionAnalysis>>();

async function analyse(dir: string, slug: string): Promise<ElectionAnalysis> {
  const entry = (await listElections(dir)).find((e) => e.slug === slug);
  if (!entry) throw new DomainError("not_found");
  const [{ dataset }, golden] = await Promise.all([loadDataset(dir, entry), loadGolden(dir, entry)]);
  const nameOf = new Map(dataset.candidates.map((c) => [c.id, c.name]));
  const name = (id: string) => nameOf.get(id) ?? id;
  const contenders = dataset.candidates.filter((c) => !c.excluded && !c.countsOnlyForOvervote);
  const matrix = pairwise(dataset.candidates, dataset.ballots);
  const plurality = pluralityWinner(dataset.candidates, dataset.ballots);
  return {
    slug,
    contenders: contenders.map((c) => c.name),
    writeIns: contenders.filter((c) => c.isWriteIn).map((c) => c.name),
    pairwise: {
      matrix: Object.fromEntries(
        Object.entries(matrix.matrix).map(([a, row]) => [name(a), Object.fromEntries(Object.entries(row).map(([b, n]) => [name(b), n]))]),
      ),
      condorcetWinner: matrix.condorcetWinner === null ? null : name(matrix.condorcetWinner),
      condorcetLoser: matrix.condorcetLoser === null ? null : name(matrix.condorcetLoser),
    },
    pluralityWinner: plurality === null ? null : name(plurality),
    official: golden ? { rounds: golden.rounds, winners: golden.winners } : null,
  };
}

/** Worked out once per server instance and kept, like the replays. */
export function getElectionAnalysis(slug: string, dir: string = ELECTIONS_DIR): Promise<ElectionAnalysis> {
  const key = `${dir}\n${slug}`;
  let pending = analyses.get(key);
  if (!pending) {
    pending = analyse(dir, slug);
    analyses.set(key, pending);
    pending.catch(() => analyses.delete(key));
  }
  return pending;
}
