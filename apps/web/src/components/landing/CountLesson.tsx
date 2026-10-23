import { formatVotes, fromUnits, sharedPlaces, toUnits } from "@/lib/votes";
import type { CountedPoll } from "./lessonData";
import { ClearFigure, DealFigure, SurplusFigure, WinFigure, type ThreeTrays } from "./LessonFigures";
import { getLesson } from "./loaders";
import { N, Section } from "./Section";
import { capitalize, countWord, listOf } from "./words";

const byVotes = (tally: Record<string, string>) => Object.entries(tally).sort(([, a], [, b]) => Number(b) - Number(a));

function StepTitle({ n, children }: { n: number; children: string }) {
  return (
    <h3 className="title lp-step-title">
      <span className="lp-step-n" aria-hidden="true">
        {n}
      </span>
      {children}
    </h3>
  );
}

/** Rounds 1 and 2 of the lunch vote: deal, clear the smallest tray, count again. */
function lunchSteps(poll: CountedPoll) {
  const { results, options } = poll;
  const [r1, r2] = results.rounds;
  if (!r1 || !r2) throw new Error("the lunch vote needs two rounds");
  const trays: ThreeTrays = options.slice(0, 3).map((label, i) => ({ label, chit: i, count: Number(r1.tally[label] ?? 0) }));
  const outName = r1.eliminated[0]!;
  const out = options.indexOf(outName);
  const moves = Object.entries(r1.transfers.find((t) => t.from === outName)?.to ?? {}).filter(([k]) => k !== "exhausted");
  const moved = Number(r1.tally[outName]);
  const [toName] = moves[0]!;
  const to = options.indexOf(toName);
  const winner = results.winners[0]!;
  const allOneWay = moves.length === 1 && Number(moves[0]![1]) === moved;
  const firsts = byVotes(r1.tally);
  const seconds = byVotes(r2.tally);

  return [
    {
      title: "Deal the first choices",
      figure: (
        <DealFigure
          trays={trays}
          head={`${r1.threshold} of ${results.totalBallots} to win`}
          label={`Round 1: ${firsts.map(([k, v]) => `${k} ${v}`).join(", ")}`}
        />
      ),
      text: (
        <>
          Every ballot goes to its first choice:{" "}
          {firsts.map(([k, v], i) => (
            <span key={k}>
              {i > 0 ? ", " : ""}
              {k} <N>{v}</N>
            </span>
          ))}
          . A winner needs more than half, <N>{r1.threshold}</N> of <N>{results.totalBallots}</N>.
        </>
      ),
    },
    {
      title: "Clear the smallest tray",
      figure: (
        <ClearFigure trays={trays} out={out} to={to} moved={moved} label={`${outName} is out; its ${moved} ballots move to ${toName}`} />
      ),
      text: (
        <>
          Nobody has <N>{r1.threshold}</N>, so {outName} is out. Its <N>{moved}</N> ballots move to each voter&apos;s next choice
          {allOneWay ? (
            <>
              , and all {countWord(moved)} ranked {toName} next.
            </>
          ) : (
            <>: {listOf(moves.map(([k, v]) => `${v} to ${k}`))}.</>
          )}
        </>
      ),
    },
    {
      title: "Count again",
      figure: (
        <WinFigure
          trays={trays}
          out={out}
          winner={options.indexOf(winner)}
          received={{ chit: out, count: moved }}
          label={`Round 2: ${seconds.map(([k, v]) => `${k} ${v}`).join(", ")}; ${winner} wins`}
        />
      ),
      text: (
        <>
          {seconds.map(([k, v], i) => (
            <span key={k}>
              {i > 0 ? ", " : ""}
              {k} <N>{v}</N>
            </span>
          ))}
          . {winner} holds a majority and wins in round {results.rounds.length}. A ballot with no choices left would be turned face down instead.
        </>
      ),
    },
  ];
}

/** Round 1 of the committee vote: a surplus moving on as slivers. */
function surplusStep(poll: CountedPoll) {
  const { results, options } = poll;
  const r1 = results.rounds[0]!;
  const r2 = results.rounds[1]!;
  const name = r1.elected[0]!;
  const transfer = r1.transfers.find((t) => t.from === name)!;
  const dp = sharedPlaces([r1.threshold, ...Object.values(r1.tally), ...Object.values(transfer.to)]);
  const tally = toUnits(r1.tally[name]!, dp);
  const surplus = tally - toUnits(r1.threshold, dp);
  const scale = 10n ** BigInt(dp);
  const share = (surplus * scale) / tally;
  // At the engine's places, like every other figure here: 0.3000, 1.8000.
  const fraction = formatVotes(fromUnits(share, dp));
  const dests = Object.entries(transfer.to).filter(([k]) => k !== "exhausted" && k !== "residualSurplus");
  const others = dests.map(([label, amount]) => ({
    label,
    chit: options.indexOf(label),
    count: Number(r1.tally[label] ?? 0),
    value: `${r1.tally[label] ?? 0} + ${formatVotes(amount)}`,
    slivers: Number((toUnits(amount, dp) * scale) / share / scale),
  }));
  // Three trays fit; the rest of the 20 ballots are named under them.
  const drawn = [name, ...others.slice(0, 2).map((o) => o.label)];
  const unseen = Object.entries(r1.tally).filter(([k]) => !drawn.includes(k));
  return {
    title: "More seats, same table",
    figure: (
      <SurplusFigure
        elected={{ label: name, chit: options.indexOf(name), count: Number(r1.tally[name]), value: `${r2.tally[name]}, elected` }}
        others={others}
        fraction={Number(share) / Number(scale)}
        head={`quota ${r1.threshold} of ${results.totalBallots}`}
        foot={unseen.length > 0 ? `Not shown: ${unseen.map(([k, v]) => `${k} ${formatVotes(v)}`).join(", ")}` : undefined}
        label={`${name}'s surplus moves on: ${dests.map(([k, v]) => `${formatVotes(v)} to ${k}`).join(", ")}`}
      />
    ),
    text: (
      <>
        With {results.seats} seats from {results.totalBallots} ballots the quota is <N>{r1.threshold}</N>. {name} has <N>{r1.tally[name]}</N>, so{" "}
        <N>{formatVotes(fromUnits(surplus, dp))}</N> are surplus: each of her ballots moves on at <N>{fraction}</N>, sending{" "}
        {dests.map(([k, v], i) => (
          <span key={k}>
            {i > 0 ? (i === dests.length - 1 ? " and " : ", ") : ""}
            <N>{formatVotes(v)}</N> to {k}
          </span>
        ))}
        .
      </>
    ),
  };
}

/** How a count works, at the size of a lunch vote, with the engine's own figures. */
export async function CountLesson() {
  const { lunch, committee } = await getLesson();
  const steps = [...lunchSteps(lunch), surplusStep(committee)];
  const { results, options } = lunch;
  const winner = results.winners[0]!;
  const plurality = results.pluralityWinner;
  const condorcet = results.condorcetWinner;
  const rivals = options.filter((o) => o !== winner);
  const m = results.pairwise.matrix;

  return (
    <Section
      id="count"
      tone="walnut"
      title="How a count works"
      lede={`The same rules a city uses, at the size of a lunch vote. ${capitalize(countWord(results.totalBallots))} people ranked ${listOf(options)}. Here one chit is one ballot.`}
    >
      <ol className="lp-steps">
        {steps.map((step, i) => (
          <li key={step.title} className="lp-step">
            <figure className="felt lp-step-fig">{step.figure}</figure>
            <StepTitle n={i + 1}>{step.title}</StepTitle>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>
      <div className="lp-count-note">
        <div className="paper lp-note-slip">
          <p className="lp-note-h">Would plain plurality agree?</p>
          <p>
            {plurality !== winner ? "No. " : "Yes. "}
            {plurality} had the most first choices, so a pick-one vote elects {plurality}. Ranked choice elects {winner}
            {condorcet === winner ? (
              <>
                , and {winner} also wins every head-to-head match-up:{" "}
                {rivals.map((r, i) => (
                  <span key={r}>
                    {i > 0 ? " and " : ""}
                    <N>{m[winner]?.[r]}</N>&ndash;<N>{m[r]?.[winner]}</N> over {r}
                  </span>
                ))}
                .
              </>
            ) : (
              "."
            )}{" "}
            Every results page runs this check.
          </p>
        </div>
        <dl className="lp-note-facts">
          <div>
            <dt>Ranked-choice winner</dt>
            <dd>{winner}</dd>
          </div>
          <div>
            <dt>Condorcet winner</dt>
            <dd>{condorcet ?? "None"}</dd>
          </div>
          <div className={plurality !== winner ? "is-other" : undefined}>
            <dt>Plurality would pick</dt>
            <dd>{plurality ?? "None"}</dd>
          </div>
        </dl>
      </div>
    </Section>
  );
}
