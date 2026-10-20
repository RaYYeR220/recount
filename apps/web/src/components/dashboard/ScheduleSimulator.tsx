import Form from "next/form";
import { Button, Callout, Field, Input } from "@/components/ui";
import { formatWhen, parseWallInput, WALL_INPUT_FORMAT, zoneAbbr } from "@/lib/when";
import type { PollDetail } from "@/server/polls/detail";
import { pollStatus, type PollStatus } from "@/server/polls/status";
import { resolveLocal } from "@/server/time";

const AT_THAT_TIME: Record<PollStatus, string> = {
  scheduled: "At that time this poll hasn't opened yet.",
  open: "At that time this poll is open.",
  closed: "At that time this poll is closed.",
};

/**
 * "See this poll at": the poll's status at any wall-clock time in its own zone, from
 * the same rules the ballot box uses. A plain GET form, so the answer has a URL.
 */
export function ScheduleSimulator({ poll, at, action }: { poll: PollDetail; at: string; action: string }) {
  const typed = at.trim();
  const local = typed ? parseWallInput(typed) : null;
  const error = typed && !local ? "Use the format YYYY-MM-DD HH:mm, for example 2027-03-14 09:00." : undefined;
  const instant = local ? resolveLocal(local, poll.timeZone).instant : null;

  return (
    <Form action={action} scroll={false} className="grid gap-3">
      <div className="flex flex-wrap items-start gap-3">
        <Field id="see-at" label="See this poll at" hint={`${WALL_INPUT_FORMAT}, in ${poll.timeZone}.`} error={error} className="min-w-0 flex-[1_1_16rem]">
          <Input mono name="at" defaultValue={typed} placeholder={WALL_INPUT_FORMAT} inputMode="numeric" autoComplete="off" spellCheck={false} />
        </Field>
        <Button type="submit" variant="line" className="sm:mt-[26px]">
          Show
        </Button>
      </div>
      {instant ? (
        <Callout tone="info" role="status">
          <b>{AT_THAT_TIME[pollStatus(poll, instant)]}</b> That&apos;s {formatWhen(instant, poll.timeZone)} {zoneAbbr(instant, poll.timeZone)} in {poll.timeZone}.
        </Callout>
      ) : null}
    </Form>
  );
}
