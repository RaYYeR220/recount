import type { ReactNode } from "react";

export type BallotWhen = {
  /** "Open now", "Opens …", "Closed …" */
  lead: string;
  /** The time that matters, already in the poll's zone, or null. */
  time: string | null;
  timeZone: string;
};

export type BallotHeadProps = {
  title: ReactNode;
  description?: string;
  when?: BallotWhen;
  /** Heading id, for the section's aria-labelledby. */
  id?: string;
};

/** The top of a ballot slip: the question, its note, and when voting runs, zone named. */
export function BallotHead({ title, description, when, id }: BallotHeadProps) {
  return (
    <div className="flex flex-col items-start gap-3 border-b-[1.5px] border-ink pb-5 sm:flex-row sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <h1 id={id} tabIndex={-1} className="title text-[clamp(30px,3vw,40px)] text-ink [overflow-wrap:anywhere] focus:outline-none">
          {title}
        </h1>
        {description ? <p className="mt-1.5 max-w-[52ch] whitespace-pre-line text-ink-2">{description}</p> : null}
      </div>
      {when ? (
        <p className="flex-none text-sm text-ink-2 sm:text-right">
          {when.lead}
          {when.time ? <b className="block text-ink">{when.time}</b> : null}
          <span className="block">{when.timeZone}</span>
        </p>
      ) : null}
    </div>
  );
}
