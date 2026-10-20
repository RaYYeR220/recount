import type { ReactNode } from "react";
import { Chit } from "@/components/ui";
import { BallotHead, type BallotWhen } from "./BallotHead";

export type PollNoticeProps = {
  title: string;
  description: string;
  when?: BallotWhen;
  /** The one thing a voter needs to know now, as a heading. */
  headline: string;
  children?: ReactNode;
  actions?: ReactNode;
  /** The options, shown greyed: what the ballot will hold, or held. */
  options?: string[];
};

/** A ballot slip with no ballot on it: not open yet, closed, or already voted. */
export function PollNotice({ title, description, when, headline, children, actions, options }: PollNoticeProps) {
  return (
    <section aria-labelledby="ballot-title" className="paper gilt-frame mx-auto max-w-[980px] px-[18px] pb-6 pt-[22px] sm:px-[38px] sm:pb-8 sm:pt-[34px]">
      <BallotHead id="ballot-title" title={title} description={description} when={when} />
      <div className="mt-6 grid gap-5 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-7">
        <div className="grid content-start gap-3">
          <h2 className="title text-2xl text-ink">{headline}</h2>
          {children ? <div className="grid gap-2 text-ink-2">{children}</div> : null}
          {actions ? <div className="mt-2 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        {options?.length ? (
          <div>
            <h3 className="mb-2.5 text-sm font-bold text-ink-2">On the ballot</h3>
            <ul className="m-0 grid list-none gap-1.5 p-0">
              {options.map((label, i) => (
                <li key={`${i}-${label}`} className="flex items-center gap-2.5 rounded-[12px] bg-paper-2 px-3 py-2 text-sm font-semibold text-ink-2 [overflow-wrap:anywhere]">
                  <Chit index={i} size="sm" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
