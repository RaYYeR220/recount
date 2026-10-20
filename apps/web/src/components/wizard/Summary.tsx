"use client";

import type { ReactNode } from "react";
import type { PollCheck } from "@/app/new/actions";
import { Button, Chit } from "@/components/ui";
import { ACCESS_LABEL, methodLong, presetInfo, RESULTS_LONG } from "@/lib/pollText";
import { formatWhen, parseWallInput, wallDay, wallTime } from "@/lib/when";
import { optionLabels, seatCount, type Draft } from "./draft";

export type SummaryProps = {
  draft: Draft;
  timeZone: string;
  check: Extract<PollCheck, { ok: true }> | null;
  /** Steps reached so far; later facts are left out of the side card. */
  upTo: number;
  /** When set, each group gets a Change button that goes to its step. */
  onEdit?: (step: number) => void;
};

/** When a typed time resolves, with the zone named; createPoll's instant once it is known. */
export function whenText(text: string, instant: Date | null | undefined, timeZone: string): string {
  if (instant) return `${formatWhen(instant, timeZone)} (${timeZone})`;
  const local = parseWallInput(text);
  return local ? `${wallDay(local)}, ${wallTime(local)} (${timeZone})` : text;
}

/** The draft as a list of facts: the side card's "So far" and the review step. */
export function Summary({ draft, timeZone, check, upTo, onEdit }: SummaryProps) {
  const labels = optionLabels(draft);
  const preset = presetInfo(draft.presetId);
  const rows: Array<{ step: number; term: string; value: ReactNode }> = [
    { step: 0, term: "Title", value: draft.title.trim() || "Untitled poll" },
    ...(draft.description.trim() && onEdit ? [{ step: 0, term: "Description", value: draft.description.trim() }] : []),
    {
      step: 0,
      term: "Options",
      value: (
        <span className="flex flex-wrap gap-1.5">
          {labels.map((label, i) => (
            <span key={`${i}-${label}`} className="inline-flex max-w-full items-center gap-1.5 rounded-chip bg-paper-2 py-[3px] pl-[5px] pr-2.5 font-bold [overflow-wrap:anywhere]">
              <Chit index={i} size="xs" />
              {label}
            </span>
          ))}
        </span>
      ),
    },
    { step: 1, term: "Method", value: methodLong(seatCount(draft) || 2) },
    { step: 2, term: "Rules", value: preset?.name ?? draft.presetId },
    { step: 2, term: "Voters rank", value: draft.maxRanks === null ? "As many as they like" : `Up to ${draft.maxRanks}` },
    { step: 3, term: "Access", value: ACCESS_LABEL[draft.accessMode] },
    { step: 3, term: "Results", value: RESULTS_LONG[draft.resultsVisibility] },
    { step: 4, term: "Time zone", value: timeZone },
    {
      step: 4,
      term: "Opens",
      value: draft.openMode === "now" ? "As soon as it's created" : whenText(draft.opensText, check?.opensAt, timeZone),
    },
    { step: 4, term: "Closes", value: draft.closesText.trim() ? whenText(draft.closesText, check?.closesAt, timeZone) : "When you close it" },
  ].filter((row) => row.step <= upTo);

  return (
    <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm">
      {rows.map((row, i) => {
        const firstOfStep = rows.findIndex((r) => r.step === row.step) === i;
        return (
          <div key={row.term} className="contents">
            <dt className="text-ink-3">{row.term}</dt>
            <dd className="m-0 flex min-w-0 items-start justify-between gap-3 font-bold text-ink [overflow-wrap:anywhere]">
              <span className="min-w-0">{row.value}</span>
              {onEdit && firstOfStep ? (
                <Button variant="quiet" size="sm" className="!min-h-0 flex-none px-0 text-ink-2" onClick={() => onEdit(row.step)}>
                  Change<span className="sr-only"> {row.term.toLowerCase()}</span>
                </Button>
              ) : null}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
