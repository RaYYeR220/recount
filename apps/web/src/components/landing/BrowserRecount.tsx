"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { cx } from "@/lib/cx";
import type { Published, RecountPoll } from "./auditData";

type Check = { state: "idle" | "done" | "fail"; note?: ReactNode };
type Checks = { fetch: Check; hash: Check; count: Check };

const IDLE: Checks = { fetch: { state: "idle" }, hash: { state: "idle" }, count: { state: "idle" } };
const STEPS: Array<[keyof Checks, string]> = [
  ["fetch", "Read the cast-vote record"],
  ["hash", "Hash it and compare with the published SHA-256"],
  ["count", "Count it and compare winner and rounds"],
];

/**
 * Fetches the poll's CVR from this deployment's API, hashes the bytes, counts them
 * with the engine in this tab and compares with what the poll published when it
 * closed. The engine loads on the first click.
 */
export function BrowserRecount({ cvrUrl, poll, published }: { cvrUrl: string; poll: RecountPoll; published: Published }) {
  const [checks, setChecks] = useState<Checks>(IDLE);
  const [busy, setBusy] = useState(false);
  const [ran, setRan] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: ReactNode } | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    setChecks(IDLE);
    const done = (key: keyof Checks, ok: boolean, note: ReactNode) => setChecks((c) => ({ ...c, [key]: { state: ok ? "done" : "fail", note } }));
    try {
      const res = await fetch(cvrUrl, { cache: "no-store" });
      if (!res.ok) {
        done("fetch", false, `The API answered ${res.status}.`);
        setResult({ ok: false, text: "The cast-vote record could not be fetched, so there is nothing to recount." });
        return;
      }
      const bytes = await res.arrayBuffer();
      const { recountCvr } = await import("./recount");
      const out = await recountCvr(bytes, poll, published);
      done("fetch", true, `${out.ballots} ballots, ${out.columns} rank columns`);
      done(
        "hash",
        out.hashMatches,
        <>
          <span className="mono">{out.sha256.slice(0, 12)}&hellip;</span> {out.hashMatches ? "matches the published hash" : "does not match the published hash"}
        </>,
      );
      done("count", out.countMatches, `Winner ${out.winners.join(", ")} in round ${out.rounds}`);
      setResult(
        out.hashMatches && out.countMatches
          ? {
              ok: true,
              text: (
                <>
                  Recount matches: same winner, same {out.rounds} rounds, CVR SHA-256 <span className="mono">{out.sha256.slice(0, 12)}</span>
                </>
              ),
            }
          : { ok: false, text: "Recount does not match the published result." },
      );
    } catch {
      setResult({ ok: false, text: "This browser could not run the recount here (hashing needs a secure page)." });
    } finally {
      setBusy(false);
      setRan(true);
    }
  }

  return (
    <>
      <ol className="lp-checks">
        {STEPS.map(([key, label]) => (
          <li key={key} className={cx(checks[key].state === "done" && "is-done", checks[key].state === "fail" && "is-fail")}>
            <span className="lp-ck" aria-hidden="true" />
            <span>
              {label}
              {checks[key].note ? <small>{checks[key].note}</small> : null}
            </span>
          </li>
        ))}
      </ol>
      <Button variant="brass" className="lp-recount-btn" onClick={run} disabled={busy} aria-busy={busy}>
        {ran ? "Recount again" : "Recount in your browser"}
      </Button>
      <div className={cx("lp-recount-result", result && !result.ok && "is-fail")} role="status" aria-live="polite">
        {result?.text}
      </div>
    </>
  );
}
