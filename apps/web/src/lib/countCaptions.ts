/**
 * Round captions and lamp labels written from the engine's round records, for any
 * count. A caption says what moved coming into the round (the previous round's
 * eliminations and surpluses) and what stands now (who wins or reaches the quota).
 */
import type { ResultRound } from "@/server/results/serialize";
import { formatUnits, formatVotes, fromUnits, toUnits } from "./votes";

export type CaptionPart = {
  text: string;
  /** lead: the round headline; figure: a vote figure; strong: a winner. */
  tone?: "lead" | "figure" | "strong";
};

export type RoundDescription = { label: string; caption: CaptionPart[] };

export type CaptionContext = {
  rounds: readonly ResultRound[];
  multiSeat: boolean;
  noun: "option" | "candidate";
  unit: "ballots" | "votes";
  dp: number;
  short: (label: string) => string;
  isTrailing: (index: number) => boolean;
};

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const word = (n: number) => WORDS[n] ?? String(n);
const plural = (label: string) => /^(undeclared\s+)?write[\s-]?ins?$/i.test(label.trim());

/** "a, b and c" */
function joinList(items: CaptionPart[][]): CaptionPart[] {
  const out: CaptionPart[] = [];
  items.forEach((item, i) => {
    if (i > 0) out.push({ text: i === items.length - 1 ? " and " : ", " });
    out.push(...item);
  });
  return out;
}

export function describeRounds(ctx: CaptionContext): RoundDescription[] {
  const { rounds, multiSeat, noun, unit, dp, short } = ctx;
  const U = (v: string | undefined) => (v === undefined ? 0n : toUnits(v, dp));
  const fig = (v: string | bigint): CaptionPart => ({ text: typeof v === "bigint" ? formatUnits(v, dp) : formatVotes(v), tone: "figure" });
  const t = (text: string): CaptionPart => ({ text });
  const one = unit === "votes" ? "vote" : "ballot";
  const nouns = `${noun}s`;

  /** "a to A, b to B and c to the other 7", plus whatever went inactive. */
  function destinations(to: Record<string, string>): { list: CaptionPart[]; inactive: bigint; count: number } {
    const entries = Object.entries(to)
      .filter(([k, v]) => k !== "exhausted" && k !== "residualSurplus" && U(v) > 0n)
      .sort((a, b) => (U(b[1]) > U(a[1]) ? 1 : U(b[1]) < U(a[1]) ? -1 : 0));
    const inactive = U(to.exhausted);
    let items: CaptionPart[][];
    if (entries.length > 4) {
      const head = entries.slice(0, 3);
      const rest = entries.slice(3).reduce((a, [, v]) => a + U(v), 0n);
      items = [...head.map(([k, v]) => [fig(v), t(` to ${short(k)}`)]), [fig(rest), t(` to the other ${word(entries.length - 3)}`)]];
    } else {
      items = entries.map(([k, v]) => [fig(v), t(` to ${short(k)}`)]);
    }
    return { list: joinList(items), inactive, count: entries.length };
  }

  /** " 649 have no choices left and go inactive." */
  function inactiveSentence(amount: bigint): CaptionPart[] {
    if (amount === 0n) return [];
    const single = amount === 10n ** BigInt(dp);
    return [t(" "), fig(amount), t(single ? " has no choices left and goes inactive." : " have no choices left and go inactive.")];
  }

  function eliminationText(prev: ResultRound): CaptionPart[] {
    const sources = prev.eliminated;
    const merged: Record<string, string> = {};
    let total = 0n;
    for (const s of sources) {
      total += U(prev.tally[s]);
      const tr = prev.transfers.find((x) => x.from === s);
      for (const [k, v] of Object.entries(tr?.to ?? {})) merged[k] = fromUnits(U(merged[k]) + U(v), dp);
    }
    const name = sources.length === 1 ? short(sources[0]!) : "";
    if (total === 0n) return [t(sources.length > 1 ? `They held no ${unit}.` : `${name} held no ${unit}.`)];
    const their = sources.length > 1 || plural(sources[0]!);
    const whose = their ? "their" : `${name}'s`;
    const onlyOne = total === 10n ** BigInt(dp) && sources.length === 1;
    const { list, inactive, count } = destinations(merged);
    if (count === 0) {
      if (onlyOne) return [t(`${their ? "Their" : whose} one ${one} has no choices left and goes inactive.`)];
      return [t("All "), fig(total), t(` of ${whose} ${unit} have no choices left and go inactive.`)];
    }
    if (count === 1 && inactive === 0n) {
      const dest = Object.keys(merged).find((k) => k !== "exhausted" && k !== "residualSurplus" && U(merged[k]) > 0n)!;
      if (onlyOne) return [t(`${their ? "Their" : whose} one ${one} moves to ${short(dest)}.`)];
      return [t("All "), fig(total), t(` of ${whose} ${unit} move to ${short(dest)}.`)];
    }
    return [t(`${their ? "Their" : whose} `), fig(total), t(` ${unit} move on: `), ...list, t("."), ...inactiveSentence(inactive)];
  }

  function surplusText(prev: ResultRound, from: string, trailing: boolean): CaptionPart[] {
    const tally = U(prev.tally[from]);
    const quota = U(prev.threshold);
    const surplus = tally > quota ? tally - quota : 0n;
    const tr = prev.transfers.find((x) => x.from === from);
    if (surplus === 0n || !tr) return [];
    if (trailing) return [t(`Every seat is filled, so ${short(from)}'s surplus of `), fig(surplus), t(" is set aside instead of moving on.")];
    const value = (surplus * 10n ** BigInt(dp)) / tally;
    const { list, inactive, count } = destinations(tr.to);
    return [
      t(`${short(from)}'s surplus of `),
      fig(surplus),
      t(" moves on at "),
      fig(value),
      t(` a ${one}`),
      ...(count > 0 ? [t(": "), ...list] : []),
      t("."),
      ...inactiveSentence(inactive),
    ];
  }

  function standing(r: ResultRound): CaptionPart[] {
    const out: CaptionPart[] = [];
    if (!multiSeat) {
      for (const x of r.elected) {
        const tally = U(r.tally[x]);
        const active = U(r.activeTotal);
        const why = tally * 2n > active ? "more than half" : "the most left";
        out.push(t(" "), { text: short(x), tone: "strong" }, t(" has "), fig(tally), t(" of "), fig(active), t(` ${unit}, ${why}, and wins.`));
      }
      return out;
    }
    const quota = U(r.threshold);
    const reached = r.elected.filter((x) => U(r.tally[x]) >= quota);
    const rest = r.elected.filter((x) => U(r.tally[x]) < quota);
    for (const x of reached) {
      out.push(t(" "), { text: short(x), tone: "strong" }, t(" reaches the quota of "), fig(r.threshold), t(" with "), fig(r.tally[x]!), t(" and is elected."));
    }
    if (rest.length > 0) {
      out.push(t(` Only as many ${nouns} remain as seats, so `));
      rest.forEach((x, k) => {
        if (k > 0) out.push(t(k === rest.length - 1 ? " and " : ", "));
        out.push({ text: short(x), tone: "strong" }, t(k === 0 ? " is elected with " : " with "), fig(r.tally[x]!));
      });
      out.push(t("."));
    }
    return out;
  }

  return rounds.map((r, i) => {
    const n = i + 1;
    if (i === 0) {
      const caption: CaptionPart[] = [{ text: "Round 1, first choices.", tone: "lead" }];
      if (multiSeat) {
        if (r.elected.length === 0) caption.push(t(" Nobody reaches the quota of "), fig(r.threshold), t(", so the count goes on."));
        caption.push(...standing(r));
      } else {
        caption.push(t(" "), fig(r.activeTotal), t(` ${unit} count.`));
        if (r.elected.length > 0) caption.push(...standing(r));
        else {
          const leader = Object.entries(r.tally).sort((a, b) => (U(b[1]) > U(a[1]) ? 1 : U(b[1]) < U(a[1]) ? -1 : 0))[0];
          if (leader) caption.push(t(` ${short(leader[0])} leads with `), fig(leader[1]), t(", short of the "), fig(r.threshold), t(" needed, so the count goes on."));
        }
      }
      return { label: "First choices", caption };
    }

    const prev = rounds[i - 1]!;
    if (ctx.isTrailing(i)) {
      const setAside = prev.elected.flatMap((x) => surplusText(prev, x, true));
      return {
        label: "Seats filled; surplus set aside",
        caption: [
          { text: `Round ${n}, seats filled; surplus set aside.`, tone: "lead" },
          t(" "),
          ...(setAside.length
            ? setAside
            : [t("Every seat is filled and no surplus is left over, so nothing moves. RCTab reports this extra round for any surplus set aside after the last seat.")]),
        ],
      };
    }

    const eliminated = prev.eliminated;
    const surpluses = prev.elected.filter((x) => {
      const tr = prev.transfers.find((y) => y.from === x);
      return tr && Object.values(tr.to).some((v) => U(v) > 0n);
    });

    let lead: string;
    let label: string;
    if (eliminated.length === 1) {
      const x = short(eliminated[0]!);
      lead = `Round ${n}, ${plural(eliminated[0]!) ? `${x.toLowerCase()} are` : `${x} is`} eliminated.`;
      label = `${x} out`;
    } else if (eliminated.length > 1) {
      lead =
        eliminated.length <= 3
          ? `Round ${n}, ${eliminated.map(short).join(eliminated.length === 2 ? " and " : ", ").replace(/, ([^,]*)$/, " and $1")} are eliminated together.`
          : `Round ${n}, ${word(eliminated.length)} ${nouns} are eliminated together.`;
      label = `${eliminated.length} out`;
    } else if (surpluses.length > 0) {
      lead = `Round ${n}, ${surpluses.map((x) => `${short(x)}'s`).join(" and ")} surplus moves on.`;
      label = `${short(surpluses[0]!)} surplus`;
    } else {
      lead = `Round ${n}.`;
      label = `Round ${n}`;
    }
    if (r.elected.length > 0) label = multiSeat ? `${short(r.elected[0]!)} elected` : "Final round";

    const caption: CaptionPart[] = [{ text: lead, tone: "lead" }];
    for (const x of surpluses) caption.push(t(" "), ...surplusText(prev, x, false));
    if (eliminated.length > 0) caption.push(t(" "), ...eliminationText(prev));
    caption.push(...standing(r));
    return { label, caption: tidy(caption) };
  });
}

/** Drops a full stop that would follow one already there ("Mary S.." after an initial). */
function tidy(parts: CaptionPart[]): CaptionPart[] {
  return parts.map((part, i) => {
    const before = parts[i - 1]?.text ?? "";
    return before.endsWith(".") && part.text.startsWith(".") ? { ...part, text: part.text.slice(1) } : part;
  });
}

/** Caption as plain text, for tests and accessible names. */
export function captionText(parts: readonly CaptionPart[]): string {
  return parts.map((p) => p.text).join("");
}
