"use client";

import { Field, Input, RadioCard } from "@/components/ui";
import { presetFits, presetInfo } from "@/lib/pollText";
import { optionLabels, seatCount, type Draft } from "./draft";
import type { FieldsProps } from "./fields";

/** One winner or several; picking the count keeps the rules preset compatible. */
export function MethodFields({ draft, update, errors }: FieldsProps) {
  const most = optionLabels(draft).length - 1;

  function choose(winners: Draft["winners"]) {
    const preset = presetInfo(draft.presetId);
    const seats = winners === "one" ? 1 : Math.max(2, seatCount({ ...draft, winners }) || 2);
    const keepsPreset = preset ? presetFits(preset, seats).ok : false;
    update({ winners, ...(keepsPreset ? {} : { presetId: "recount-standard", maxRanks: null }) });
  }

  return (
    <>
      <fieldset className="m-0 grid gap-2 border-0 p-0">
        <legend className="label mb-2.5 p-0">How many winners?</legend>
        <RadioCard
          id="winners-one"
          name="winners"
          checked={draft.winners === "one"}
          onChange={() => choose("one")}
          title="One winner"
          description="Instant runoff: the option in last place drops out and its ballots move to their next choice, until one option has more than half."
        />
        <RadioCard
          id="winners-many"
          name="winners"
          checked={draft.winners === "many"}
          onChange={() => choose("many")}
          title="Several winners"
          description="Single transferable vote: each seat needs a quota of ballots, and votes a winner doesn't need move on to the next choice."
        />
      </fieldset>
      {draft.winners === "many" ? (
        <Field id="seats" label="Seats to fill" hint={most >= 2 ? `Between 2 and ${most}, one fewer than the options.` : "Add a third option first."} error={errors.seats}>
          <Input
            type="number"
            inputMode="numeric"
            min={2}
            max={Math.max(2, most)}
            value={draft.seats}
            onChange={(e) => update({ seats: e.target.value })}
            className="max-w-[10rem]"
          />
        </Field>
      ) : null}
    </>
  );
}
