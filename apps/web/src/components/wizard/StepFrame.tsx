"use client";

import { useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { Button, Callout } from "@/components/ui";

export type StepFrameProps = {
  title: string;
  hint: ReactNode;
  /** Problems for the whole step, shown above the footer. */
  problems?: string[];
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
  pending?: boolean;
  pendingLabel?: string;
  /** Put focus on the heading when the step appears (after moving between steps). */
  focusHeading?: boolean;
  children: ReactNode;
};

/**
 * One wizard step on paper: a heading that takes focus when the step is reached,
 * the fields, then Back and the step's main button. Enter in a field continues.
 */
export function StepFrame({ title, hint, problems = [], onBack, onNext, nextLabel, pending, pendingLabel, focusHeading, children }: StepFrameProps) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!focusHeading) return;
    // Scrolls only when the heading is out of view; its scroll margin keeps it clear of the sticky header.
    heading.current?.scrollIntoView({ block: "nearest" });
    heading.current?.focus({ preventScroll: true });
    // Only when the step first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending) onNext();
  }

  return (
    <form noValidate onSubmit={submit} aria-labelledby="step-title" className="paper px-[18px] py-[22px] sm:px-8 sm:pb-[26px] sm:pt-[30px]">
      <h2
        id="step-title"
        ref={heading}
        tabIndex={-1}
        className="title scroll-mt-[calc(var(--header-h)+38px)] text-2xl text-ink focus:outline-none sm:scroll-mt-[calc(var(--header-h)+46px)]"
      >
        {title}
      </h2>
      <div className="mt-1.5 text-ink-3">{hint}</div>
      <div className="mt-[26px] grid gap-6">{children}</div>
      {problems.length > 0 ? (
        <Callout tone="fail" role="alert" className="mt-6">
          {problems.length === 1 ? (
            problems[0]
          ) : (
            <ul className="grid list-disc gap-1 pl-4">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </Callout>
      ) : null}
      <div className="mt-[30px] flex flex-wrap items-center justify-between gap-3 border-t border-paper-3 pt-5">
        {onBack ? (
          <Button variant="line" onClick={onBack}>
            Back
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" variant="brass" size="lg" disabled={pending} aria-busy={pending || undefined}>
          {pending && pendingLabel ? pendingLabel : nextLabel}
        </Button>
      </div>
    </form>
  );
}
