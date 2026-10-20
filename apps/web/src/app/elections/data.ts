import { cacheLife } from "next/cache";
import { getElectionAnalysis, type ElectionAnalysis } from "@/server/electionAnalysis";
import { getElection, listElections, type ElectionReplay, type ElectionSummary } from "@/server/elections";

/**
 * The replays only change with a deploy, so the engine counts them once while the
 * site is built and the pages ship as static HTML.
 */
export async function electionList(): Promise<ElectionSummary[]> {
  "use cache";
  cacheLife("max");
  return listElections();
}

export async function electionReplay(slug: string): Promise<{ replay: ElectionReplay; analysis: ElectionAnalysis }> {
  "use cache";
  cacheLife("max");
  const [replay, analysis] = await Promise.all([getElection(slug), getElectionAnalysis(slug)]);
  return { replay, analysis };
}
