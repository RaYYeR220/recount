"use client";

import type { PollCheck } from "@/app/new/actions";
import { Field, Input, RadioCard, Select } from "@/components/ui";
import { formatDay, formatTime, WALL_INPUT_FORMAT, zoneAbbr } from "@/lib/when";
import { toCreateInput } from "./draft";
import type { FieldsProps } from "./fields";
import { ScheduleWarnings } from "./ScheduleWarnings";

export type ScheduleFieldsProps = FieldsProps & {
  zones: readonly string[];
  /** The zone in use: the one picked, or the browser's. */
  timeZone: string;
  browserZone: string;
  /** createPoll's answer for exactly this schedule, once it has come back. */
  check: Extract<PollCheck, { ok: true }> | null;
};

function groupZones(zones: readonly string[]): Array<[string, string[]]> {
  const groups = new Map<string, string[]>();
  for (const zone of zones) {
    const region = zone.includes("/") ? zone.slice(0, zone.indexOf("/")) : "Other";
    groups.set(region, [...(groups.get(region) ?? []), zone]);
  }
  return [...groups];
}

/** "Sunday, March 14, 2027, 3:30 AM EDT (America/New_York)" */
function longWhen(date: Date, timeZone: string): string {
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone }).format(date);
  return `${weekday}, ${formatDay(date, timeZone)}, ${formatTime(date, timeZone)} ${zoneAbbr(date, timeZone)} (${timeZone})`;
}

/**
 * Time zone, opening and closing. Times are typed as wall clock in the poll's zone;
 * what they resolve to, and any DST adjustment, comes back from createPoll itself.
 */
export function ScheduleFields({ draft, update, errors, zones, timeZone, browserZone, check }: ScheduleFieldsProps) {
  const input = toCreateInput(draft, timeZone);
  const warningProps = {
    warnings: check?.warnings ?? [],
    opensAtLocal: input.opensAtLocal,
    closesAtLocal: input.closesAtLocal,
    opensAt: check?.opensAt ?? null,
    closesAt: check?.closesAt ?? null,
    timeZone,
  };
  return (
    <>
      <Field
        id="time-zone"
        label="Time zone"
        hint={browserZone ? `Your browser is in ${browserZone}. Pick the zone your voters think in.` : "Pick the zone your voters think in."}
        error={errors.timeZone}
      >
        <Select value={timeZone} onChange={(e) => update({ timeZone: e.target.value })} className="max-w-[26rem]">
          {groupZones(zones).map(([region, list]) => (
            <optgroup key={region} label={region}>
              {list.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </Field>

      <fieldset className="m-0 grid gap-2 border-0 p-0">
        <legend className="label mb-2.5 p-0">Opening</legend>
        <RadioCard
          id="open-now"
          name="openMode"
          checked={draft.openMode === "now"}
          onChange={() => update({ openMode: "now" })}
          title="As soon as the poll is created"
          description="Voters can use the link straight away."
        />
        <RadioCard
          id="open-at"
          name="openMode"
          checked={draft.openMode === "at"}
          onChange={() => update({ openMode: "at" })}
          title="At a set time"
          description="Before then, the link shows when voting starts."
        />
      </fieldset>

      <div className="grid items-start gap-4 sm:grid-cols-2">
        {draft.openMode === "at" ? (
          <div className="grid gap-2">
            <Field id="opens" label="Opens" hint={`Format ${WALL_INPUT_FORMAT}, 24-hour, in ${timeZone}.`} error={errors.opens}>
              <Input mono value={draft.opensText} onChange={(e) => update({ opensText: e.target.value })} placeholder={WALL_INPUT_FORMAT} inputMode="numeric" autoComplete="off" spellCheck={false} />
            </Field>
          </div>
        ) : null}
        <div className="grid gap-2">
          <Field id="closes" label="Closes" optional hint="Leave empty to close the poll by hand." error={errors.closes}>
            <Input mono value={draft.closesText} onChange={(e) => update({ closesText: e.target.value })} placeholder={WALL_INPUT_FORMAT} inputMode="numeric" autoComplete="off" spellCheck={false} />
          </Field>
          <ScheduleWarnings field="closesAt" {...warningProps} />
        </div>
      </div>

      {check && (check.closesAt || draft.openMode === "at") ? (
        <p className="text-sm text-ink-2 [&_b]:text-ink">
          {draft.openMode === "at" && check.opensAt ? (
            <>
              Opens <b>{longWhen(check.opensAt, timeZone)}</b>.{" "}
            </>
          ) : null}
          {check.closesAt ? (
            <>
              Closes <b>{longWhen(check.closesAt, timeZone)}</b>.
            </>
          ) : null}
        </p>
      ) : null}
    </>
  );
}
