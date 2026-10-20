"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Chit } from "@/components/ui";
import { moveDown, moveUp, ordinal, rankOption, removeOption } from "@/lib/ranking";
import { useHydrated } from "@/lib/useHydrated";

export type BallotOption = { id: string; label: string };

export type RankerProps = {
  /** In ballot order; an option's index is its chit. */
  options: BallotOption[];
  ranking: string[];
  onChange: (ranking: string[]) => void;
  maxRanks: number | null;
};

type Act = "rank" | "up" | "down" | "remove";

/**
 * Click-to-rank: "Rank" adds an option as the next choice; ranked options move with
 * "Move up" and "Move down" and come off with "Remove". Every control is a button, so
 * the keyboard does everything a pointer does; focus follows the option that moved
 * and each change is read out.
 */
export function Ranker({ options, ranking, onChange, maxRanks }: RankerProps) {
  const root = useRef<HTMLDivElement>(null);
  const ready = useHydrated();
  const [focusTarget, setFocusTarget] = useState<{ act: Act; id: string; fallback: Act } | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const index = new Map(options.map((o, i) => [o.id, i]));
  const label = (id: string) => options[index.get(id)!]!.label;
  const unranked = options.filter((o) => !ranking.includes(o.id));
  const full = maxRanks !== null && ranking.length >= maxRanks;

  useEffect(() => {
    if (!focusTarget || !root.current) return;
    const find = (act: Act, id: string) => root.current!.querySelector<HTMLButtonElement>(`[data-act="${act}"][data-id="${id}"]:not(:disabled)`);
    const target =
      find(focusTarget.act, focusTarget.id) ??
      find(focusTarget.fallback, focusTarget.id) ??
      root.current.querySelector<HTMLButtonElement>('[data-act="rank"]:not(:disabled)') ??
      root.current.querySelector<HTMLButtonElement>('[data-act="remove"]');
    target?.focus();
  }, [focusTarget, ranking]);

  function act(kind: Act, id: string) {
    const name = label(id);
    if (kind === "rank") {
      const next = rankOption(ranking, id, maxRanks);
      onChange(next);
      setAnnouncement(`${name} ranked ${ordinal(next.length)}.`);
      // Keep going down the list: focus the option that took this one's place.
      const after = unranked[unranked.findIndex((o) => o.id === id) + 1] ?? unranked.at(-2);
      setFocusTarget(after ? { act: "rank", id: after.id, fallback: "rank" } : { act: "up", id, fallback: "remove" });
    } else if (kind === "remove") {
      onChange(removeOption(ranking, id));
      setAnnouncement(`${name} removed from your ranking.`);
      setFocusTarget({ act: "rank", id, fallback: "rank" });
    } else {
      const next = kind === "up" ? moveUp(ranking, id) : moveDown(ranking, id);
      onChange(next);
      setAnnouncement(`${name} is now your ${ordinal(next.indexOf(id) + 1)} choice.`);
      setFocusTarget({ act: kind, id, fallback: kind === "up" ? "down" : "up" });
    }
  }

  const more = (maxRanks ?? options.length) - ranking.length;
  const notice =
    ranking.length === 0
      ? "Rank at least one option to continue."
      : full && maxRanks !== null && maxRanks < options.length
        ? `You've ranked as many as this poll allows (${maxRanks}).`
        : more > 0
          ? `You may rank ${more} more ${more === 1 ? "option" : "options"}.`
          : "You have ranked every option.";

  return (
    <div ref={root}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-7 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section aria-labelledby="ranked-title">
          <div className="mb-2.5 flex items-baseline justify-between">
            <h2 id="ranked-title" className="text-md font-bold text-ink">
              Your ranking
            </h2>
            <span className="text-[12.5px] text-ink-3">
              {ranking.length} of {maxRanks !== null && maxRanks < options.length ? maxRanks : options.length}
            </span>
          </div>
          <ol className="m-0 grid list-none gap-2 p-0">
            {ranking.map((id, i) => (
              <li
                key={id}
                className="grid grid-cols-[34px_16px_minmax(0,1fr)] items-center gap-x-2.5 gap-y-2 rounded-[14px] bg-well px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--color-paper-4),0_1px_0_rgb(255_255_255/0.6)] sm:grid-cols-[38px_18px_minmax(0,1fr)_auto] sm:pr-2.5"
              >
                <span aria-hidden="true" className="grid size-[34px] place-items-center rounded-full bg-ink font-bold text-paper">
                  {i + 1}
                </span>
                <Chit index={index.get(id)!} size="sm" />
                <span className="text-md font-bold text-ink [overflow-wrap:anywhere]">
                  <span className="sr-only">Choice {i + 1}: </span>
                  {label(id)}
                </span>
                <span className="col-span-3 flex flex-wrap gap-1.5 sm:col-span-1 sm:justify-end">
                  <Button variant="line" size="sm" data-act="up" data-id={id} disabled={!ready || i === 0} onClick={() => act("up", id)} className="!min-h-[34px] !px-3 text-[13px]">
                    Move up<span className="sr-only"> {label(id)}</span>
                  </Button>
                  <Button
                    variant="line"
                    size="sm"
                    data-act="down"
                    data-id={id}
                    disabled={!ready || i === ranking.length - 1}
                    onClick={() => act("down", id)}
                    className="!min-h-[34px] !px-3 text-[13px]"
                  >
                    Move down<span className="sr-only"> {label(id)}</span>
                  </Button>
                  <Button variant="line" size="sm" data-act="remove" data-id={id} disabled={!ready} onClick={() => act("remove", id)} className="!min-h-[34px] !px-3 text-[13px]">
                    Remove<span className="sr-only"> {label(id)}</span>
                  </Button>
                </span>
              </li>
            ))}
            {!full && unranked.length > 0 ? (
              <li aria-hidden="true" className="grid grid-cols-[38px_minmax(0,1fr)] items-center gap-2.5 rounded-[14px] border-[1.5px] border-dashed border-paper-4 px-3 py-2.5 text-sm text-ink-3">
                <span className="grid size-[34px] place-items-center rounded-full border-[1.5px] border-dashed border-paper-4 font-bold">{ranking.length + 1}</span>
                <span>Choice {ranking.length + 1}: press Rank on an option</span>
              </li>
            ) : null}
          </ol>
        </section>
        <section aria-labelledby="unranked-title">
          <div className="mb-2.5 flex items-baseline justify-between">
            <h2 id="unranked-title" className="text-md font-bold text-ink">
              Not ranked
            </h2>
          </div>
          {unranked.length > 0 ? (
            <ul className="m-0 grid list-none gap-2 p-0">
              {unranked.map((option) => (
                <li key={option.id} className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[14px] bg-paper-2 py-2 pl-3.5 pr-2">
                  <Chit index={index.get(option.id)!} size="sm" />
                  <span className="font-semibold text-ink [overflow-wrap:anywhere]">{option.label}</span>
                  <Button variant="ink" size="sm" data-act="rank" data-id={option.id} disabled={!ready || full} onClick={() => act("rank", option.id)} className="!mb-1 !px-3.5 text-[13.5px]">
                    Rank<span className="sr-only"> {option.label}</span>
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-[14px] bg-paper-2 p-3.5 text-sm text-ink-3">Every option is ranked.</p>
          )}
        </section>
      </div>
      <p className="mt-6 text-sm text-ink-2">
        {notice}
      </p>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
