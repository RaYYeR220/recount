import { Caption } from "@/components/table/Caption";
import { Callout } from "@/components/ui/Callout";
import { PanelHeader, Paper } from "@/components/ui/Surface";
import { findTies, tiebreakWords, whyItWon } from "@/lib/countStory";
import { listNames } from "@/lib/names";
import type { CountView } from "./model";

export type WhyItWonProps = {
  view: Pick<CountView, "rounds" | "winners" | "seats" | "rules" | "noun">;
  /** Where the tiebreak seed comes from, e.g. "seeded from the CVR hash". */
  seedSource?: string;
  /** The poll is still open: the story of the count so far. */
  provisional?: boolean;
  id?: string;
};

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
        <Callout key={tie.round} tone="info">
          <b>
            {listNames(tie.tied)} tied for last with {tie.at} {view.seats > 1 ? (tie.at === "1" ? "vote" : "votes") : tie.at === "1" ? "ballot" : "ballots"} each in round{" "}
            {tie.round}.
          </b>{" "}
          The tiebreak eliminated {listNames(tie.eliminated)}: {tiebreakWords(view.rules, seedSource)}.
        </Callout>
      ))}
    </Paper>
  );
}
