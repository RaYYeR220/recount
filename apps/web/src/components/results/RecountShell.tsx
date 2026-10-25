"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { STEP_TEXT } from "@/lib/recount";
import type { RecountState } from "./useRecountWorker";

export type RecountVerdict = { matches: boolean; line: ReactNode; detail?: ReactNode; differences: string[] };

export type RecountShellProps = {
  state: RecountState;
  onRun: () => void;
  /** What the finished recount says, worked out by the caller from its result. */
  verdict: RecountVerdict | null;
  /** Shown before the first run. */
  intro?: ReactNode;
};

/** Set by the form when it is sent before the page's script runs. */
const AUTO_START = "recount";

/**
 * The button, the live progress line and the verdict of a browser recount. The button
 * is a form, so a click that lands before the script has loaded still counts: the page
 * reopens with ?recount and starts the recount as soon as it can.
 */
export function RecountShell({ state, onRun, verdict, intro }: RecountShellProps) {
  const running = state.status === "running";
  const autoStarted = useRef(false);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (autoStarted.current || !url.searchParams.has(AUTO_START)) return;
    autoStarted.current = true;
    url.searchParams.delete(AUTO_START);
    window.history.replaceState(window.history.state, "", url);
    onRun();
  }, [onRun]);
  return (
    <form
      className="recount-box"
      method="get"
      onSubmit={(event) => {
        event.preventDefault();
        onRun();
      }}
    >
      <input type="hidden" name={AUTO_START} value="1" />
      <Button type="submit" variant="ink" disabled={running} aria-busy={running || undefined}>
        {running ? "Recounting…" : state.status === "idle" ? "Recount in your browser" : "Recount again"}
      </Button>
      <div role="status" aria-live="polite" className="grid gap-2.5">
        {state.status === "idle" && intro ? <p className="recount-steps">{intro}</p> : null}
        {running ? <p className="recount-steps">{STEP_TEXT[state.step]}</p> : null}
        {state.status === "error" ? (
          <Callout tone="fail">
            <b>The recount could not finish.</b> {state.message}
          </Callout>
        ) : null}
        {state.status === "done" && verdict ? (
          verdict.matches ? (
            <Callout tone="match">
              <p className="font-bold">{verdict.line}</p>
              {verdict.detail ? <p className="mt-1">{verdict.detail}</p> : null}
            </Callout>
          ) : (
            <Callout tone="fail">
              <p className="font-bold">{verdict.line}</p>
              <ul>
                {verdict.differences.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
              {verdict.detail ? <p className="mt-1">{verdict.detail}</p> : null}
            </Callout>
          )
        ) : null}
      </div>
    </form>
  );
}
