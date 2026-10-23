/**
 * Plain-language accounts of a count, written from the engine's rounds: why the
 * winner won and why ballots went inactive (ties are in countTies.ts). Figures stay
 * the engine's strings, marked so pages can set them in tabular numerals.
 */
import type { ResultRound } from "@/server/results/serialize";
import type { CaptionPart } from "./countCaptions";
import { isPluralLabel } from "./countScene";
import { findTies, placesOfRounds } from "./countTies";
import { listNames } from "./names";
import { formatUnits, formatVotes, fromUnits, toUnits } from "./votes";

export type Paragraph = CaptionPart[];

type StoryInput = {
  rounds: readonly ResultRound[];
  winners: readonly string[];
  seats: number;
  /** Display form of an option label. */
  show?: (label: string) => string;
  /** The poll is still open: the count so far, told in the present tense. */
  provisional?: boolean;
  /** What the choices are called. Default "option". */
  noun?: "option" | "candidate";
};

const fig = (text: string): CaptionPart => ({ text: formatVotes(text), tone: "figure" });
const strong = (text: string): CaptionPart => ({ text, tone: "strong" });
const t = (text: string): CaptionPart => ({ text });

/** RCTab's extra round after the last seat fills. */
export function isTrailing(rounds: readonly ResultRound[], i: number, seats: number): boolean {
  const r = rounds[i];
  return seats > 1 && i > 0 && i === rounds.length - 1 && r !== undefined && r.elected.length === 0 && r.eliminated.length === 0;
}

/** "3 to Tacos, 2 to Pizza and 1 inactive" for one transfer. */
function destinations(to: Record<string, string>, show: (l: string) => string, dp: number): Paragraph {
  const entries = Object.entries(to)
    .filter(([k, v]) => k !== "residualSurplus" && toUnits(v, dp) > 0n)
    .sort((a, b) => {
      if (a[0] === "exhausted") return 1;
      if (b[0] === "exhausted") return -1;
      const d = toUnits(b[1], dp) - toUnits(a[1], dp);
      return d > 0n ? 1 : d < 0n ? -1 : 0;
    });
  const shown = entries.length > 5 ? entries.slice(0, 4) : entries;
  const rest = entries.slice(shown.length);
  const parts: Paragraph[] = shown.map(([k, v]) => [fig(v), t(k === "exhausted" ? " went inactive" : ` to ${show(k)}`)]);
  if (rest.length > 0) {
    const sum = rest.reduce((a, [, v]) => a + toUnits(v, dp), 0n);
    parts.push([{ text: formatUnits(sum, dp), tone: "figure" }, t(` elsewhere`)]);
  }
  const out: Paragraph = [];
  parts.forEach((p, i) => {
    if (i > 0) out.push(t(i === parts.length - 1 ? " and " : ", "));
    out.push(...p);
  });
  return out;
}

function eliminationSentence(round: ResultRound, show: (l: string) => string, unit: string, dp: number): Paragraph {
  const out = round.eliminated;
  const total = out.reduce((a, x) => a + toUnits(round.tally[x] ?? "0", dp), 0n);
  const merged: Record<string, bigint> = {};
  for (const x of out) {
    for (const [k, v] of Object.entries(round.transfers.find((tr) => tr.from === x)?.to ?? {})) merged[k] = (merged[k] ?? 0n) + toUnits(v, dp);
  }
  const to = Object.fromEntries(Object.entries(merged).map(([k, v]) => [k, fromUnits(v, dp)]));
  const who =
    out.length === 1
      ? show(out[0]!)
      : out.length <= 3
        ? `${listNames(out.map(show))}`
        : `${out.slice(0, 2).map(show).join(", ")} and ${out.length - 2} others`;
  const single = out.length === 1 && !isPluralLabel(out[0]!);
  const verb = single ? "was eliminated" : out.length === 1 ? "were eliminated" : "were eliminated together";
  if (total === 0n) return [t(`${who} ${verb} with no ${unit}.`)];
  const dests = destinations(to, show, dp);
  if (dests.length === 0) return [t(`${who} ${verb}.`)];
  const one = total === 10n ** BigInt(dp);
  const what = one ? `${unit.slice(0, -1)} moved on` : `${unit} moved on`;
  return [t(`${who} ${verb} and ${single ? "its" : "their"} `), { text: formatUnits(total, dp), tone: "figure" }, t(` ${what}: `), ...dests, t(".")];
}

/** Why the winner won, in two or three short paragraphs. */
export function whyItWon({ rounds, winners, seats, show = (l) => l, provisional = false, noun = "option" }: StoryInput): Paragraph[] {
  if (rounds.length === 0 || winners.length === 0) return [];
  const dp = placesOfRounds(rounds);
  const multi = seats > 1;
  const unit = multi ? "votes" : "ballots";
  const first = rounds[0]!;
  const last = rounds.length - 1;
  const electedAt = new Map<string, number>();
  rounds.forEach((r, i) => r.elected.forEach((x) => electedAt.set(x, i)));

  // "1 of 1 ballot", "7 of 13 ballots"
  const unitFor = (v: string) => (toUnits(v, dp) === 10n ** BigInt(dp) ? unit.slice(0, -1) : unit);
  const seatTies = findTies(rounds).filter((x) => x.kind === "seat");

  if (!multi) {
    const winner = winners[0]!;
    const at = electedAt.get(winner) ?? last;
    const won = rounds[at]!;
    const short = toUnits(won.tally[winner]!, dp) < toUnits(won.threshold, dp);
    const share = [fig(won.tally[winner]!), t(" of "), fig(won.activeTotal), t(` ${unitFor(won.activeTotal)}`)];
    const where = at === 0 ? "on first choices" : `in round ${at + 1}${provisional ? " of the count so far" : ""}`;
    const tie = seatTies.find((x) => x.round === at + 1 && x.picked.includes(winner));
    const paragraphs: Paragraph[] = [];
    if (tie) {
      // Level at the top: no majority, and the tiebreak picked the winner.
      const others = tie.tied.filter((x) => x !== winner).map(show);
      paragraphs.push([
        strong(show(winner)),
        t(`${others.length > 1 ? ", " : " and "}${listNames(others)} ${provisional ? "are" : "finished"} level ${where} with `),
        ...share,
        t(" each"),
        ...(short ? [t(", short of the "), fig(won.threshold), t(" needed")] : []),
        t(provisional ? `; ${show(winner)} leads only on the tiebreak.` : `, and ${show(winner)} won on the tiebreak.`),
      ]);
    } else if (short) {
      // The last ones standing with ballots run out: the most, but not a majority.
      const left = Object.keys(won.tally).length;
      const most = left > 1 ? `the most of the last ${left === 2 ? "two" : left} left` : `the only ${noun} left`;
      paragraphs.push([strong(show(winner)), t(provisional ? " leads with " : " won with "), ...share, t(` ${where}, short of the `), fig(won.threshold), t(` needed but ${most}.`)]);
    } else if (at === 0) {
      paragraphs.push([strong(show(winner)), t(provisional ? " has a majority of first choices so far: " : " had a majority of first choices: "), ...share, t(".")]);
    } else {
      paragraphs.push([strong(show(winner)), t(provisional ? " leads with " : " won with "), ...share, t(` ${where}.`)]);
    }
    if (at === 0) return paragraphs;

    const leader = Object.entries(first.tally).sort((a, b) => {
      const d = toUnits(b[1], dp) - toUnits(a[1], dp);
      return d > 0n ? 1 : d < 0n ? -1 : 0;
    })[0]!;
    const story: Paragraph = [t(`${show(leader[0])} led the first choices with `), fig(leader[1]), t(", short of the "), fig(first.threshold), t(" needed.")];
    const elimRounds = rounds.slice(0, at).filter((r) => r.eliminated.length > 0);
    const told = elimRounds.length > 4 ? [...elimRounds.slice(0, 2), ...elimRounds.slice(-1)] : elimRounds;
    told.forEach((r, i) => {
      story.push(t(" "));
      if (elimRounds.length > 4 && i === 2) story.push(t(`After ${elimRounds.length - 3} more rounds of eliminations, `));
      const sentence = eliminationSentence(r, show, unit, dp);
      if (elimRounds.length > 4 && i === 2 && sentence[0]) sentence[0] = t(sentence[0].text.charAt(0).toLowerCase() + sentence[0].text.slice(1));
      story.push(...sentence);
    });
    paragraphs.push(story);
    if (leader[0] !== winner) {
      const place = Object.values(first.tally).filter((v) => toUnits(v, dp) > toUnits(first.tally[winner] ?? "0", dp)).length + 1;
      const ordinal = ["first", "second", "third", "fourth", "fifth"][place - 1] ?? `number ${place}`;
      paragraphs.push([t(`${show(winner)} came from behind: ${ordinal} on first choices, it ${provisional ? "leads" : "won"} on later preferences.`)]);
    }
    return paragraphs;
  }

  const paragraphs: Paragraph[] = [];
  winners.forEach((w) => {
    const at = electedAt.get(w) ?? last;
    const r = rounds[at]!;
    const tally = toUnits(r.tally[w] ?? "0", dp);
    const quota = toUnits(r.threshold, dp);
    const p: Paragraph = [];
    if (tally >= quota) {
      const firsts = tally === 10n ** BigInt(dp) ? " first choice." : " first choices.";
      p.push(strong(show(w)), t(provisional ? " reaches the quota of " : " reached the quota of "), fig(r.threshold), t(` in round ${at + 1} with `), fig(r.tally[w]!), t(at === 0 ? firsts : ` ${unitFor(r.tally[w]!)}.`));
      const transfer = r.transfers.find((tr) => tr.from === w);
      const surplus = tally - quota;
      if (transfer && surplus > 0n && !isTrailing(rounds, at + 1, seats)) {
        const dests = destinations(transfer.to, show, dp);
        const places = Math.max(dp, 4);
        const value = formatUnits((surplus * 10n ** BigInt(places)) / tally, places);
        if (dests.length > 0) p.push(t(" The surplus of "), { text: formatUnits(surplus, dp), tone: "figure" }, t(" moved on at "), { text: value, tone: "figure" }, t(" a vote: "), ...dests, t("."));
      } else if (surplus > 0n && isTrailing(rounds, at + 1, seats)) {
        p.push(t(" Every seat was filled by then, so the surplus of "), { text: formatUnits(surplus, dp), tone: "figure" }, t(" was set aside."));
      }
    } else {
      p.push(strong(show(w)), t(provisional ? ` leads in round ${at + 1} with ` : ` was elected in round ${at + 1} with `), fig(r.tally[w]!), t(`, as one of the last ${noun}s left for the remaining seats.`));
    }
    const tie = seatTies.find((x) => x.round === at + 1 && x.picked.includes(w));
    if (tie) {
      const others = listNames(tie.tied.filter((x) => !tie.picked.includes(x)).map(show));
      p.push(t(provisional ? ` ${show(w)} is level with ${others} and ahead only on the tiebreak.` : ` ${show(w)} was level with ${others} and took the seat on the tiebreak.`));
    }
    paragraphs.push(p);
  });
  const eliminated = rounds.flatMap((r) => r.eliminated);
  if (eliminated.length > 0) {
    const named = eliminated.length <= 6 ? eliminated.map(show).join(", then ") : `${eliminated.length} ${noun}s, starting with ${show(eliminated[0]!)},`;
    paragraphs.push([t(`${named} ${eliminated.length === 1 ? "was" : "were"} eliminated in turn.`)]);
  }
  if (isTrailing(rounds, last, seats)) {
    paragraphs.push([t(`Round ${last + 1} is the extra round RCTab reports after the last seat fills; nothing moves in it.`)]);
  }
  return paragraphs;
}

export const INACTIVE_REASONS = [
  { key: "exhaustedChoices", label: "No choices left", words: "had no choices left" },
  { key: "overvotes", label: "Overvote", words: "reached an overvote" },
  { key: "skippedRankings", label: "Skipped too many rankings", words: "skipped too many rankings" },
  { key: "repeatedRankings", label: "Repeated a candidate", words: "repeated a candidate" },
] as const;

export type InactiveRow = { key: string; label: string; perRound: string[] };

/** Cumulative inactive ballots by reason, round by round; reasons that never occur are left out. */
export function inactiveRows(rounds: readonly ResultRound[]): InactiveRow[] {
  const dp = placesOfRounds(rounds);
  return INACTIVE_REASONS.filter(({ key }) => rounds.some((r) => toUnits(r.inactive[key] ?? "0", dp) > 0n)).map(({ key, label }) => ({
    key,
    label,
    perRound: rounds.map((r) => r.inactive[key] ?? "0"),
  }));
}

/** "By round 3, 55,332 ballots were inactive: 50,000 had no choices left and 5,332 reached an overvote." */
export function inactiveSummary(rounds: readonly ResultRound[], unit: "ballots" | "votes"): Paragraph {
  if (rounds.length === 0) return [];
  const dp = placesOfRounds(rounds);
  const last = rounds.at(-1)!;
  const parts = INACTIVE_REASONS.map((r) => ({ ...r, value: toUnits(last.inactive[r.key] ?? "0", dp) }))
    .filter((r) => r.value > 0n)
    .sort((a, b) => (b.value > a.value ? 1 : b.value < a.value ? -1 : 0));
  const total = parts.reduce((a, p) => a + p.value, 0n);
  if (total === 0n) return [t(`No ${unit} went inactive: every one counted for an option still in the race, to the last round.`)];
  const one = total === 10n ** BigInt(dp);
  const out: Paragraph = [t(`By round ${rounds.length}, `), { text: formatUnits(total, dp), tone: "figure" }, t(` ${one ? unit.slice(0, -1) : unit} ${one ? "was" : "were"} inactive`)];
  if (parts.length === 1) out.push(t(`; ${one ? "it" : "all"} ${parts[0]!.words}.`));
  else {
    out.push(t(": "));
    parts.forEach((p, i) => {
      if (i > 0) out.push(t(i === parts.length - 1 ? " and " : ", "));
      out.push({ text: formatUnits(p.value, dp), tone: "figure" }, t(` ${p.words}`));
    });
    out.push(t("."));
  }
  return out;
}
