import type { Metadata } from "next";
import { ElectionsTable, type ElectionRow } from "@/components/elections/ElectionsTable";
import { matchLabel } from "@/components/elections/matchLabel";
import { electionList, electionReplay } from "./data";
import "@/styles/results.css";

export const metadata: Metadata = {
  title: "Elections",
  description: "Real ranked-choice elections counted again from their public ballots, figure by figure against the official reports.",
};

const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];
const word = (n: number) => WORDS[n] ?? String(n);

export default async function ElectionsPage() {
  const list = await electionList();
  const rows: ElectionRow[] = await Promise.all(
    list.map(async (entry): Promise<ElectionRow> => {
      const { replay, analysis } = await electionReplay(entry.slug);
      const mismatches = replay.comparison?.mismatches ?? [];
      const cw = analysis.pairwise.condorcetWinner;
      return {
        slug: entry.slug,
        title: replay.title,
        publisher: replay.source.publisher,
        date: replay.date,
        seats: replay.seats,
        ballots: replay.totalBallots,
        rounds: replay.rounds.length,
        winners: replay.winners,
        condorcetDiffers: replay.seats === 1 && cw && !replay.winners.includes(cw) ? cw : null,
        cells: replay.comparison?.cells ?? null,
        mismatches: mismatches.length,
        label: replay.comparison ? matchLabel(replay.presetId, mismatches) : null,
      };
    }),
  );
  const exact = rows.filter((r) => r.cells !== null && r.mismatches === 0).length;
  const others = rows.length - exact;
  const fromFairVote = rows.filter((r) => r.mismatches > 0).every((r) => r.publisher.startsWith("FairVote"));
  const copy = fromFairVote ? ` ${others === 1 ? "uses" : "use"} FairVote's copy of the ballots and` : "";

  return (
    <div className="wrap page">
      <div className="sec-head">
        <h1 className="display">{word(rows.length)} real elections, recounted from their ballots</h1>
        <p className="sec-lede">
          {exact} of {rows.length} match the official count figure for figure.
          {others > 0
            ? ` The other ${others === 1 ? "one" : word(others).toLowerCase()}${copy} ${others === 1 ? "lands" : "land"} within a few votes; ${others === 1 ? "its page shows" : "their pages show"} exactly where.`
            : ""}
        </p>
      </div>
      <ElectionsTable rows={rows} />
      <p className="replays-foot">
        Ballots come from each jurisdiction&apos;s public cast-vote record, or FairVote&apos;s normalised copy where the city&apos;s own file is gone. The official
        figures are transcribed from the published round-by-round reports, each with its own SHA-256. Every page can be counted again in your browser.
      </p>
    </div>
  );
}
