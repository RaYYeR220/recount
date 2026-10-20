"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RecountRequest, RecountResult, RecountStep, WorkerMessage } from "@/lib/recount";

export type RecountState =
  | { status: "idle" }
  | { status: "running"; step: RecountStep }
  | { status: "done"; result: RecountResult; ms: number }
  | { status: "error"; message: string };

/** Runs one recount at a time in a Web Worker; a new run or unmounting stops the last one. */
export function useRecountWorker() {
  const [state, setState] = useState<RecountState>({ status: "idle" });
  const worker = useRef<Worker | null>(null);

  useEffect(() => () => worker.current?.terminate(), []);

  const run = useCallback((request: RecountRequest) => {
    worker.current?.terminate();
    let w: Worker;
    try {
      w = new Worker(new URL("../../workers/recount.worker.ts", import.meta.url), { type: "module" });
    } catch {
      setState({ status: "error", message: "This browser could not start the recount in the background." });
      return;
    }
    worker.current = w;
    const started = performance.now();
    setState({ status: "running", step: "fetch" });
    w.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.type === "progress") setState({ status: "running", step: message.step });
      else {
        setState(message.type === "done" ? { status: "done", result: message.result, ms: performance.now() - started } : { status: "error", message: message.message });
        w.terminate();
        if (worker.current === w) worker.current = null;
      }
    };
    w.onerror = (event) => {
      event.preventDefault();
      setState({ status: "error", message: "The recount stopped unexpectedly in this browser." });
      w.terminate();
      if (worker.current === w) worker.current = null;
    };
    w.postMessage(request);
  }, []);

  return { state, run };
}
