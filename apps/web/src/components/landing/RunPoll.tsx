import type { ReactNode } from "react";
import { Chit } from "@/components/ui/Chit";
import { chitStyle } from "@/lib/optionColour";
import type { CountedPoll } from "./lessonData";
import { getLesson } from "./loaders";
import { Section } from "./Section";

function Mini({ bar, className, children }: { bar: string; className?: string; children: ReactNode }) {
  return (
    <div className={className ? `paper lp-mini ${className}` : "paper lp-mini"} aria-hidden="true">
      <div className="lp-mini-bar">
        <span className="lp-mini-dot" />
        {bar}
      </div>
      {children}
    </div>
  );
}

/** Each option's votes in a round, split by whose first choice they were. */
function segments(poll: CountedPoll, round: number, option: string): Array<{ from: number; votes: number }> {
  const { rounds } = poll.results;
  const out = [{ from: poll.options.indexOf(option), votes: Number(rounds[0]!.tally[option] ?? 0) }];
  for (let r = 0; r < round; r++) {
    for (const t of rounds[r]!.transfers) {
      const v = Number(t.to[option] ?? 0);
      if (v > 0) out.push({ from: poll.options.indexOf(t.from), votes: v });
    }
  }
  return out.filter((s) => s.votes > 0);
}

function ResultBars({ poll }: { poll: CountedPoll }) {
  const { rounds, totalBallots } = poll.results;
  return (
    <div className="lp-mini-bars">
      {rounds.map((round, r) => (
        <div key={round.round} className="lp-mb-round">
          <span>Round {round.round}</span>
          {Object.entries(round.tally)
            .sort(([, a], [, b]) => Number(b) - Number(a))
            .map(([option, votes]) => (
              <div key={option} className="lp-mb-row">
                <span>{option}</span>
                <span className="lp-mb-track">
                  {segments(poll, r, option).map((s, k) => (
                    <i key={k} style={{ width: `${(s.votes / totalBallots) * 100}%`, background: chitStyle(s.from).face }} />
                  ))}
                </span>
                <b className="num">{votes}</b>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}

/** Four little screens of the real flow, filled in with the seeded offsite poll. */
export async function RunPoll() {
  const { offsite } = await getLesson();
  const ranked = offsite.ranking;
  const unranked = offsite.options.filter((o) => !ranked.includes(o));
  const { results } = offsite;

  const steps = [
    {
      title: "Create",
      text: "Options, seats, rules, who can vote, when it opens and closes, in the poll's own time zone.",
      screen: (
        <Mini bar="New poll">
          <div className="lp-mini-body">
            <p className="lp-mini-label">Title</p>
            <p className="lp-mini-input">{offsite.title}</p>
            <p className="lp-mini-label">Options</p>
            <ul className="lp-mini-opts">
              {offsite.options.map((o, i) => (
                <li key={o}>
                  <Chit index={i} size={12} />
                  {o}
                </li>
              ))}
            </ul>
            <p className="lp-mini-row">
              <span>{results.seats === 1 ? "One winner" : `${results.seats} seats`}</span>
              <span>Results: live</span>
            </p>
            <span className="lp-mini-btn lp-mini-ink">Create poll</span>
          </div>
        </Mini>
      ),
    },
    {
      title: "Rank",
      text: "Click to add, then Move up, Move down or Remove. Every control is a button, so it works by keyboard too.",
      screen: (
        <Mini bar={offsite.title}>
          <div className="lp-mini-body">
            <p className="lp-mini-label">Your ranking</p>
            <ol className="lp-mini-rank">
              {ranked.map((o, i) => (
                <li key={o}>
                  <b>{i + 1}</b>
                  {o}
                  <span className="lp-mini-acts">
                    {i > 0 ? <i>Move up</i> : null}
                    {i < ranked.length - 1 ? <i>Move down</i> : null}
                    <i>Remove</i>
                  </span>
                </li>
              ))}
            </ol>
            <p className="lp-mini-label">Not ranked</p>
            <ul className="lp-mini-unranked">
              {unranked.map((o) => (
                <li key={o}>
                  {o}
                  <i>Rank</i>
                </li>
              ))}
            </ul>
            <span className="lp-mini-btn lp-mini-brass">Review ballot</span>
          </div>
        </Mini>
      ),
    },
    {
      title: "Keep a receipt",
      text: (
        <>
          A code in the form <span className="mono">xxxx-xxxx-xxxx</span>. Enter it later to see your ranking exactly as it was counted.
        </>
      ),
      screen: (
        <Mini bar="Ballot cast" className="lp-mini-receipt">
          <div className="lp-mini-body">
            <p className="lp-mini-label">Your receipt</p>
            <p className="lp-receipt-code mono">{offsite.receipt}</p>
            <p className="lp-mini-small">{ranked.map((o, i) => `${i + 1}. ${o}`).join("   ")}</p>
            <span className="lp-mini-link">Check your ballot</span>
          </div>
          <div className="lp-perf" />
        </Mini>
      ),
    },
    {
      title: "Read the result",
      text: "Round by round, with transfers, a plain-language reason it won, and the audit files underneath.",
      screen: (
        <Mini bar="Results">
          <div className="lp-mini-body">
            <p className="lp-mini-win">Winner: {results.winners.join(", ")}</p>
            <p className="lp-mini-small">
              {results.rounds.length} rounds, {results.totalBallots} ballots
            </p>
            <ResultBars poll={offsite} />
            <span className="lp-mini-link">RCTab summary (JSON)</span>
          </div>
        </Mini>
      ),
    },
  ];

  return (
    <Section
      id="poll"
      tone="deep"
      title="Run your own poll"
      lede="Four screens and no drag and drop. Voters rank by clicking, keep a receipt, and can look their ballot up after the count."
    >
      <ol className="lp-flow">
        {steps.map((step, i) => (
          <li key={step.title} className="lp-flow-step">
            <div className="lp-flow-lamp" aria-hidden="true">
              <span>{i + 1}</span>
            </div>
            {step.screen}
            <h3 className="title lp-flow-title">{step.title}</h3>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
