"use client";

import { Badge, ErrorText, Field, RadioCard, Select } from "@/components/ui";
import { PRESETS, presetFits } from "@/lib/pollText";
import { optionLabels, seatCount } from "./draft";
import type { FieldsProps } from "./fields";

/**
 * The four counting rule sets an organizer can pick, each in one sentence, and how
 * many choices a voter may rank. Picking a city's rules takes its ranking limit.
 */
export function RulesFields({ draft, update, errors }: FieldsProps) {
  const seats = seatCount(draft);
  const optionCount = optionLabels(draft).length;

  return (
    <>
      <fieldset aria-describedby={errors.presetId ? "preset-error" : undefined} className="m-0 grid gap-2 border-0 p-0">
        <legend className="label mb-2.5 p-0">Pick a set of rules</legend>
        {PRESETS.map((preset) => {
          const fits = presetFits(preset, seats);
          return (
            <RadioCard
              key={preset.id}
              id={`preset-${preset.id}`}
              name="presetId"
              checked={draft.presetId === preset.id}
              disabled={!fits.ok}
              onChange={() =>
                update({
                  presetId: preset.id,
                  maxRanks: preset.maxRanks === null || preset.maxRanks >= optionCount ? null : preset.maxRanks,
                })
              }
              title={preset.name}
              description={
                <>
                  {preset.sentence}
                  {fits.ok ? null : (
                    <Badge tone="neutral" className="ml-2 align-middle">
                      {fits.reason}
                    </Badge>
                  )}
                </>
              }
            />
          );
        })}
        {errors.presetId ? <ErrorText id="preset-error">{errors.presetId}</ErrorText> : null}
      </fieldset>
      <Field id="max-ranks" label="How many can each voter rank?" hint="Unranked options get none of that voter's ballot." error={errors.maxRanks}>
        <Select
          value={draft.maxRanks === null ? "" : String(draft.maxRanks)}
          onChange={(e) => update({ maxRanks: e.target.value === "" ? null : Number(e.target.value) })}
          className="max-w-[20rem]"
        >
          <option value="">As many as they like</option>
          {Array.from({ length: Math.max(0, optionCount - 1) }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              Up to {n}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}
