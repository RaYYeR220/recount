"use client";

import type { PresetId } from "@recount/engine";
import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import { ResultsLayout } from "@/components/results/ResultsLayout";
import { WinnerCard } from "@/components/results/WinnerCard";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { PanelHeader, Paper } from "@/components/ui/Surface";
import { Tabs } from "@/components/ui/Tabs";
import { formatBallotError, parseBallotCsv, type BallotCsvError } from "@/lib/ballotCsv";
import { buildCountScene } from "@/lib/countScene";
import { PRESET_NAMES, presetName } from "@/lib/presetNames";
import { formatCount } from "@/lib/votes";
import { countBallots, type CountOutcome } from "./countBallots";
import { OVERVOTE_EXAMPLE, TIE_EXAMPLE } from "./examples";
import { RctabView } from "./RctabView";

const SHOWN_ERRORS = 12;

type Counted = { outcome: Extract<CountOutcome, { ok: true }>; presetId: PresetId; seats: number; ballots: number; body: unknown };

/** Paste ballots, pick a jurisdiction's rules, count. Everything runs in this browser. */
export function CountTool() {
  const [text, setText] = useState("");
  const [presetId, setPresetId] = useState<PresetId>("recount-standard");
  const [seats, setSeats] = useState("1");
  const [errors, setErrors] = useState<BallotCsvError[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const [counted, setCounted] = useState<Counted | null>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const errorsId = useId();

  const scene = useMemo(
    () => (counted ? buildCountScene({ rounds: counted.outcome.view.rounds, options: counted.outcome.view.options, seats: counted.seats, noun: "candidate" }) : null),
    [counted],
  );

  function load(example: string) {
    setText(example);
    setErrors([]);
    setFailure(null);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const seatCount = Number(seats);
    if (!Number.isInteger(seatCount) || seatCount < 1 || seatCount > 100) {
      setErrors([]);
      setFailure("Seats must be a whole number from 1 to 100.");
      return;
    }
    const parsed = parseBallotCsv(text);
    setErrors(parsed.errors);
    if (parsed.errors.length > 0) {
      setFailure(null);
      return;
    }
    const outcome = countBallots(parsed, presetId, seatCount);
    if (!outcome.ok) {
      setFailure(outcome.message);
      return;
    }
    setFailure(null);
    setCounted({
      outcome,
      presetId,
      seats: seatCount,
      ballots: parsed.totalBallots,
      body: {
        contest: "Pasted ballots",
        candidates: parsed.candidates,
        ballots: parsed.ballots.map((b) => ({ ranking: b.ranking.map((slot) => (slot.length === 1 ? slot[0] : slot)), count: b.count })),
        presetId,
        seats: seatCount,
      },
    });
    requestAnimationFrame(() => resultRef.current?.focus());
  }

  const preset = presetName(presetId);
  return (
    <>
      <div className="count-grid">
        <Paper as="section" aria-labelledby="ballots-h">
          <PanelHeader id="ballots-h" title="Ballots" description="Counted in this browser. Nothing is uploaded." />
          <form onSubmit={onSubmit} noValidate className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="line" size="sm" onClick={() => load(OVERVOTE_EXAMPLE)}>
                Load the overvote example
              </Button>
              <Button variant="line" size="sm" onClick={() => load(TIE_EXAMPLE)}>
                Load the tie example
              </Button>
            </div>
            <Field
              id="ballot-text"
              label="Ballots, one per line"
              hint="Ranks separated by commas. Ash|Cal marks two names at one rank; an empty field skips a rank; end a line with x3 for three identical ballots."
            >
              <Textarea
                rows={10}
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
                autoComplete="off"
                className="mono text-sm"
                placeholder={"Pizza,Tacos,Sushi\nTacos,Pizza x2\nSushi|Tacos,Pizza\nPizza,,Sushi"}
                aria-invalid={errors.length > 0 || undefined}
                aria-errormessage={errors.length > 0 ? errorsId : undefined}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
              <Field id="rules" label="Rules" hint={preset.description}>
                <Select value={presetId} onChange={(e) => setPresetId(e.target.value as PresetId)}>
                  {PRESET_NAMES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="seats" label="Seats">
                <Input type="number" inputMode="numeric" min={1} max={100} step={1} value={seats} onChange={(e) => setSeats(e.target.value)} />
              </Field>
            </div>
            {errors.length > 0 ? (
              <Callout tone="fail" role="alert" id={errorsId}>
                <p className="font-bold">
                  {errors.length === 1 ? "One line needs fixing" : `${formatCount(errors.length)} lines need fixing`} before the count can run.
                </p>
                <ul className="mt-1 grid gap-0.5">
                  {errors.slice(0, SHOWN_ERRORS).map((e) => (
                    <li key={`${e.line}-${e.message}`}>{formatBallotError(e)}</li>
                  ))}
                  {errors.length > SHOWN_ERRORS ? <li>And {formatCount(errors.length - SHOWN_ERRORS)} more.</li> : null}
                </ul>
              </Callout>
            ) : null}
            {failure ? (
              <Callout tone="fail" role="alert">
                {failure}
              </Callout>
            ) : null}
            <div>
              <Button type="submit" variant="ink" size="lg">
                Count
              </Button>
            </div>
          </form>
        </Paper>

        <Paper as="aside" aria-labelledby="format-h" className="count-guide">
          <PanelHeader id="format-h" title="How to write ballots" level={2} />
          <dl>
            <dt>
              <code>Pizza,Tacos,Sushi</code>
            </dt>
            <dd>One ballot: Pizza first, Tacos second, Sushi third.</dd>
            <dt>
              <code>Tacos,Pizza x12</code>
            </dt>
            <dd>Twelve ballots that rank the same way.</dd>
            <dt>
              <code>Pizza|Sushi,Tacos</code>
            </dt>
            <dd>An overvote: two names at rank 1. Some rules skip that rank, others end the ballot there.</dd>
            <dt>
              <code>Pizza,,Sushi</code>
            </dt>
            <dd>Rank 2 left blank. Some rules end a ballot after too many skipped ranks.</dd>
            <dt>
              <code>&quot;Peltola, Mary S.&quot;,Begich</code>
            </dt>
            <dd>Quotes around a name with a comma in it.</dd>
          </dl>
          <p className="hint-line">Lines starting with # are notes. Candidates are listed in the order they first appear, which also sets their chit colours.</p>
        </Paper>
      </div>

      {counted && scene ? (
        <section aria-labelledby="result-h" className="mt-10">
          <div className="res-head">
            <div className="min-w-0">
              <h2 id="result-h" ref={resultRef} tabIndex={-1} className="display page-title focus:outline-none">
                The count
              </h2>
              <p className="page-desc">
                {formatCount(counted.ballots)} {counted.ballots === 1 ? "ballot" : "ballots"} under {presetName(counted.presetId).label} rules,{" "}
                {counted.seats === 1 ? "one seat" : `${counted.seats} seats`}.
              </p>
            </div>
            <WinnerCard view={counted.outcome.view} />
          </div>
          <Tabs
            label="Result views"
            tone="dark"
            tabs={[
              {
                id: "count",
                label: "Count",
                panel: (
                  <ResultsLayout view={counted.outcome.view} scene={scene} title="Your ballots: the count, round by round" seedSource={`seed ${counted.outcome.view.rules.randomSeed ?? "0"}`} />
                ),
              },
              {
                id: "rctab",
                label: "RCTab summary (JSON)",
                panel: <RctabView summary={counted.outcome.rctab} body={counted.body} />,
              },
            ]}
          />
        </section>
      ) : null}
    </>
  );
}
