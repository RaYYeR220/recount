import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/lib/cx";

export type StepperStep = {
  label: ReactNode;
  /** Makes a finished step a link back to it. */
  href?: string;
};

export type StepperProps = {
  /** Accessible name, e.g. "New poll steps" or "Voting steps". */
  label: string;
  steps: StepperStep[];
  /** 0-based index of the step in view. */
  current: number;
  /** spread: steps share the width on a gilt track (wizard); inline: compact (ballot). */
  variant?: "spread" | "inline";
  className?: string;
};

/** Brass lamps for a multi-step flow: done, current, to come. On phones only the current label shows. */
export function Stepper({ label, steps, current, variant = "spread", className }: StepperProps) {
  const style = { "--steps": steps.length, "--current": current } as CSSProperties;
  return (
    <ol aria-label={label} className={cx("stepper", `stepper-${variant}`, className)} style={style}>
      {steps.map((step, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        const body = (
          <>
            <span className="stepper-dot" aria-hidden="true">
              {i + 1}
            </span>
            <span className="stepper-label">
              {step.label}
              {state === "done" ? <span className="sr-only"> (done)</span> : null}
            </span>
          </>
        );
        return (
          <li key={i} data-state={state} aria-current={state === "current" ? "step" : undefined}>
            {step.href && state === "done" ? <Link href={step.href}>{body}</Link> : body}
          </li>
        );
      })}
    </ol>
  );
}
