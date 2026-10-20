"use client";

import { RadioCard } from "@/components/ui";
import { ACCESS_DETAIL, ACCESS_LABEL, RESULTS_DETAIL, RESULTS_LONG, type AccessMode, type ResultsVisibility } from "@/lib/pollText";
import type { FieldsProps } from "./fields";

const ACCESS: AccessMode[] = ["link", "codes"];
const RESULTS: ResultsVisibility[] = ["live", "after_close", "owner_only"];

/** Who may vote, and who may see the count and when. */
export function AccessFields({ draft, update }: FieldsProps) {
  return (
    <>
      <fieldset className="m-0 grid gap-2 border-0 p-0">
        <legend className="label mb-2.5 p-0">Who can vote?</legend>
        {ACCESS.map((mode) => (
          <RadioCard
            key={mode}
            id={`access-${mode}`}
            name="accessMode"
            checked={draft.accessMode === mode}
            onChange={() => update({ accessMode: mode })}
            title={ACCESS_LABEL[mode]}
            description={mode === "codes" ? `${ACCESS_DETAIL[mode]} You generate the codes once the poll exists.` : ACCESS_DETAIL[mode]}
          />
        ))}
      </fieldset>
      <fieldset className="m-0 grid gap-2 border-0 p-0">
        <legend className="label mb-2.5 p-0">Who sees the results?</legend>
        {RESULTS.map((visibility) => (
          <RadioCard
            key={visibility}
            id={`results-${visibility}`}
            name="resultsVisibility"
            checked={draft.resultsVisibility === visibility}
            onChange={() => update({ resultsVisibility: visibility })}
            title={RESULTS_LONG[visibility]}
            description={RESULTS_DETAIL[visibility]}
          />
        ))}
      </fieldset>
    </>
  );
}
