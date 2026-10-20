"use client";

import type { PollCheck } from "@/app/new/actions";
import { Chit } from "@/components/ui";
import { cx } from "@/lib/cx";
import { parseWallInput } from "@/lib/when";
import { optionLabels, seatCount, type Draft } from "./draft";
import { whenText } from "./Summary";

const SHOWN = 6;

/** A small felt card that follows the draft: what a voter will meet on the link. */
export function VoterPreview({
  draft,
  timeZone,
  check,
  className,
}: {
  draft: Draft;
  timeZone: string;
  check: Extract<PollCheck, { ok: true }> | null;
  className?: string;
}) {
  const labels = optionLabels(draft);
  const seats = seatCount(draft);
  const scheduled = draft.openMode === "at" && parseWallInput(draft.opensText) !== null;
  const heading = scheduled ? "What voters see before it opens" : "What voters see";

  return (
    <section aria-labelledby="voter-preview" className={cx("felt px-[22px] py-5", className)}>
      <h3 id="voter-preview" className="mb-2 text-xs font-bold text-cream-2">
        {heading}
      </h3>
      <p className="title text-lg text-cream [overflow-wrap:anywhere]">{draft.title.trim() || "Untitled poll"}</p>
      <div aria-live="polite" className="mt-1 text-sm text-cream">
        {scheduled ? (
          <>
            <b className="block">Voting hasn&apos;t started yet.</b>
            Opens {whenText(draft.opensText, check?.opensAt, timeZone)}.
          </>
        ) : (
          <>
            <b className="block">Open now.</b>
            {draft.maxRanks === null ? "Rank as many options as you like" : `Rank up to ${draft.maxRanks}`}
            {seats > 1 ? `; ${seats} seats will be filled.` : "; one winner."}
          </>
        )}
      </div>
      {labels.length > 0 ? (
        <ul className="m-0 mt-3.5 grid list-none gap-1.5 p-0">
          {labels.slice(0, SHOWN).map((label, i) => (
            <li key={`${i}-${label}`} className="flex items-center gap-2 rounded-[10px] bg-[rgb(243_239_230/0.07)] px-2.5 py-1.5 text-sm text-cream [overflow-wrap:anywhere]">
              <Chit index={i} size="sm" />
              {label}
            </li>
          ))}
          {labels.length > SHOWN ? <li className="px-2.5 text-xs text-cream-2">and {labels.length - SHOWN} more</li> : null}
        </ul>
      ) : null}
      <p className="mt-3.5 text-xs text-cream-2">
        {draft.accessMode === "codes" ? "They'll need an invite code from you." : "Anyone with the link can vote, once per browser."}
      </p>
    </section>
  );
}
