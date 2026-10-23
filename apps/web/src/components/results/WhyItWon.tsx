import { Caption } from "@/components/table/Caption";
import { Callout } from "@/components/ui/Callout";
import { PanelHeader, Paper } from "@/components/ui/Surface";
import { whyItWon } from "@/lib/countStory";
import { findTies, tieBreakPhrase, type Tie } from "@/lib/countTies";
import { listNames } from "@/lib/names";
import type { CountView } from "./model";

export type WhyItWonProps = {
  view: Pick<CountView, "rounds" | "winners" | "seats" | "rules" | "noun">;
  /** Where tiebreak draws come from, after "a draw": "seeded from the cast-vote record's SHA-256". */
  seedSource?: string;
  /** The poll is still open: the story of the count so far. */
  provisional?: boolean;
  id?: string;
};

/** Who tied, with what, in which round, and how the rules settled it. */
function TieNote({ tie, view, seedSource, provisional }: { tie: Tie } & Omit<WhyItWonProps, "id">) {
  const unit = view.seats > 1 ? (tie.at === "1" ? "vote" : "votes") : tie.at === "1" ? "ballot" : "ballots";
  const how = tieBreakPhrase(tie, view.rounds, view.rules, seedSource);
  const picked = listNames(tie.picked);
  if (tie.kind === "last") {
    return (
      <Callout tone="info">
        <b>
          {listNames(tie.tied)} tied for last with {tie.at} {unit} each in round {tie.round}.
        </b>{" "}
        The tiebreak eliminated {picked} {how}.
      </Callout>
    );
  }
  return (
    <Callout tone="info">
      <b>
        {listNames(tie.tied)} tied with {tie.at} {unit} each in round {tie.round}.
      </b>{" "}
      {provisional ? `The tiebreak puts ${picked} ahead ${how}.` : `The tiebreak elected ${picked} ${how}.`}
    </Callout>
  );
}

/** The count in plain words, with every tie the rules had to break. */
export function WhyItWon({ view, seedSource, provisional, id = "why-h" }: WhyItWonProps) {
  const paragraphs = whyItWon({ ...view, provisional });
  const ties = findTies(view.rounds);
  const title = provisional ? (view.seats > 1 ? "Why they lead" : "Why it leads") : view.seats > 1 ? "Why they won" : "Why it won";
  return (
    <Paper as="section" aria-labelledby={id} className="story">
      <PanelHeader id={id} title={title} />
      {paragraphs.map((parts, i) => (
        <p key={i}>
          <Caption parts={parts} />
        </p>
      ))}
      {ties.map((tie) => (
        <TieNote key={`${tie.kind}-${tie.round}-${tie.at}`} tie={tie} view={view} seedSource={seedSource} provisional={provisional} />
      ))}
    </Paper>
  );
}
