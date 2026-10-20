import Link from "next/link";
import { ButtonLink } from "@/components/ui";
import { ACCESS_LABEL, ballotsText, methodLabel, RESULTS_LABEL } from "@/lib/pollText";
import { scheduleLine } from "@/lib/scheduleText";
import type { PollSummary } from "@/server/polls/list";
import { StatusMark } from "./StatusMark";

/** Table cells on desktop; below 900px each row turns into a card. */
const TH = "whitespace-nowrap border-b border-paper-3 bg-paper-2 px-3.5 py-2.5 text-left text-xs font-bold text-ink-2 first:pl-5 last:pr-5";
const TD =
  "h-[54px] border-b border-paper-3 px-3.5 py-2 align-middle first:pl-5 last:pr-5 group-hover:bg-[rgb(201_161_74/0.07)] max-[900px]:block max-[900px]:h-auto max-[900px]:border-0 max-[900px]:!p-0";
const FACT = "max-[900px]:flex-none max-[900px]:text-[12.5px] max-[900px]:text-ink-2";

function Row({ poll }: { poll: PollSummary }) {
  const manage = `/dashboard/p/${poll.slug}`;
  return (
    <tr className="group max-[900px]:flex max-[900px]:flex-wrap max-[900px]:items-baseline max-[900px]:gap-x-3.5 max-[900px]:gap-y-1 max-[900px]:border-b max-[900px]:border-paper-3 max-[900px]:px-4 max-[900px]:py-3.5">
      <th scope="row" className={`${TD} text-left font-normal max-[900px]:min-w-0 max-[900px]:flex-[1_1_60%]`}>
        <Link href={manage} className="block font-bold text-ink [overflow-wrap:anywhere] hover:underline hover:underline-offset-[3px]">
          {poll.title}
        </Link>
        <span className="mono mt-px block text-[11.5px] text-ink-3">{poll.slug}</span>
      </th>
      <td className={`${TD} max-[900px]:ml-auto max-[900px]:flex-none`}>
        <StatusMark status={poll.status} />
      </td>
      <td className={`${TD} whitespace-nowrap ${FACT}`}>{methodLabel(poll.seats)}</td>
      <td className={`${TD} num text-right ${FACT}`}>
        <span className="max-[900px]:hidden">{poll.ballotCount.toLocaleString("en-US")}</span>
        <span className="hidden max-[900px]:inline">{ballotsText(poll.ballotCount)}</span>
      </td>
      <td className={`${TD} whitespace-nowrap ${FACT}`}>{ACCESS_LABEL[poll.accessMode]}</td>
      <td className={`${TD} whitespace-nowrap text-ink-2 ${FACT}`}>
        <span className="hidden max-[900px]:inline">Results: </span>
        {RESULTS_LABEL[poll.resultsVisibility]}
      </td>
      <td className={`${TD} whitespace-nowrap text-ink-2 max-[900px]:mt-1 max-[900px]:flex-[1_1_100%] max-[900px]:whitespace-normal`}>
        {scheduleLine(poll)}
        <small className="block text-[11.5px] text-ink-3">{poll.timeZone}</small>
      </td>
      <td className={`${TD} text-right max-[900px]:mt-1.5 max-[900px]:flex-[1_1_100%] max-[900px]:text-left`}>
        <span className="inline-flex gap-1.5">
          <ButtonLink href={manage} variant="line" size="sm" className="!min-h-8 !px-3 text-[13px]">
            Manage<span className="sr-only"> {poll.title}</span>
          </ButtonLink>
          {poll.status === "scheduled" ? null : (
            <ButtonLink href={`/p/${poll.slug}/results`} variant="line" size="sm" className="!min-h-8 !px-3 text-[13px]">
              Results<span className="sr-only"> of {poll.title}</span>
            </ButtonLink>
          )}
        </span>
      </td>
    </tr>
  );
}

/** The owner's polls, newest first: what each one is, who can vote, and when. */
export function PollTable({ polls }: { polls: PollSummary[] }) {
  return (
    <table className="w-full border-separate border-spacing-0 text-sm text-ink max-[900px]:block">
      <caption className="sr-only">Your polls, newest first</caption>
      <thead className="max-[900px]:hidden">
        <tr>
          <th scope="col" className={TH}>
            Poll
          </th>
          <th scope="col" className={TH}>
            Status
          </th>
          <th scope="col" className={TH}>
            Method
          </th>
          <th scope="col" className={`${TH} text-right`}>
            Ballots
          </th>
          <th scope="col" className={TH}>
            Access
          </th>
          <th scope="col" className={TH}>
            Results
          </th>
          <th scope="col" className={TH}>
            Schedule
          </th>
          <th scope="col" className={TH}>
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody className="max-[900px]:block">
        {polls.map((poll) => (
          <Row key={poll.slug} poll={poll} />
        ))}
      </tbody>
    </table>
  );
}
