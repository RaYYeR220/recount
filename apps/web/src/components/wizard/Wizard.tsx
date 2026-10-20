"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { checkNewPoll, createNewPoll, type PollCheck } from "@/app/new/actions";
import { Paper, Stepper } from "@/components/ui";
import { useHydrated } from "@/lib/useHydrated";
import type { CreatePollInput } from "@/server/polls/schema";
import type { Issue } from "@/server/validation";
import { AccessFields } from "./AccessFields";
import { emptyDraft, firstOpenStep, REVIEW_STEP, stepIssues, stepOfPath, STEPS, toCreateInput, type Draft } from "./draft";
import { MethodFields } from "./MethodFields";
import { OptionsFields } from "./OptionsFields";
import { RulesFields } from "./RulesFields";
import { ScheduleFields } from "./ScheduleFields";
import { ScheduleWarnings } from "./ScheduleWarnings";
import { StepFrame } from "./StepFrame";
import { Summary } from "./Summary";
import { useBrowserZone } from "./useBrowserZone";
import { WizardSkeleton } from "./WizardSkeleton";
import { VoterPreview } from "./VoterPreview";

const SCHEDULE_STEP = 4;
const CHECK_DELAY_MS = 450;

const STEP_COPY: Array<{ title: string; hint: string }> = [
  { title: "What are people choosing between?", hint: "Give the poll a title and list the options. Voters rank them by clicking." },
  { title: "Method and seats", hint: "One winner for a single decision, or several to fill a committee or a shortlist." },
  { title: "Counting rules", hint: "Each set is the one a city uses for its real elections. If you're not sure, keep Recount standard." },
  { title: "Who votes, who sees", hint: "Who can vote is fixed once ballots arrive; who sees the results you can change later." },
  { title: "When can people vote?", hint: "Times are entered in the poll's time zone and shown to every voter in that zone, with the zone named." },
  { title: "Check and create", hint: "This is the poll as it will be created. Nothing is saved until you press Create poll." },
];

/** Server paths to the field names the steps show errors under. */
const FIELD_OF_PATH: Record<string, string> = {
  title: "title",
  description: "description",
  options: "options",
  seats: "seats",
  presetId: "presetId",
  maxRanks: "maxRanks",
  timeZone: "timeZone",
  opensAtLocal: "opens",
  closesAtLocal: "closes",
};

function stepHref(step: number): string {
  return step === 0 ? "/new" : `/new?step=${step + 1}`;
}

function withPeriod(message: string): string {
  return /[.!?]$/.test(message) ? message : `${message}.`;
}

/**
 * The new-poll wizard. The draft lives here; the step lives in the URL (?step=), so
 * Back and the stepper work like pages. The schedule and the review are checked by
 * createPoll itself, run without keeping the poll, so its DST warnings and its
 * validation appear before anything is created.
 */
export function Wizard({ zones }: { zones: readonly string[] }) {
  const params = useSearchParams();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [attempted, setAttempted] = useState<ReadonlySet<number>>(new Set());
  const [check, setCheck] = useState<{ key: string; result: PollCheck } | null>(null);
  const [createIssues, setCreateIssues] = useState<Issue[]>([]);
  const [pending, startTransition] = useTransition();
  const latestCheck = useRef("");
  const ready = useHydrated();

  const browserZone = useBrowserZone(zones);
  const timeZone = draft.timeZone || browserZone || "UTC";
  const requested = Math.min(Math.max(Number.parseInt(params.get("step") ?? "1", 10) - 1 || 0, 0), REVIEW_STEP);
  const reachable = firstOpenStep(draft);
  const step = Math.min(requested, reachable);

  // Focus moves to the step heading when the step changes, not on the first render.
  const [shownStep, setShownStep] = useState(step);
  const [moved, setMoved] = useState(false);
  if (shownStep !== step) {
    setShownStep(step);
    setMoved(true);
  }

  const input: CreatePollInput = toCreateInput(draft, timeZone);
  const key = JSON.stringify(input);
  const current = check?.key === key ? check.result : null;
  const okCheck = current?.ok ? current : null;
  const scheduleReady = reachable >= SCHEDULE_STEP && stepIssues(draft, SCHEDULE_STEP).length === 0;

  async function runCheck(forInput: CreatePollInput, forKey: string): Promise<PollCheck> {
    latestCheck.current = forKey;
    const result = await checkNewPoll(forInput);
    if (latestCheck.current === forKey) setCheck({ key: forKey, result });
    return result;
  }

  // On the schedule and review steps, ask createPoll about the schedule a moment after typing stops.
  const hasCheck = current !== null;
  useEffect(() => {
    if (step < SCHEDULE_STEP || !scheduleReady || hasCheck) return;
    const timer = window.setTimeout(() => {
      latestCheck.current = key;
      void checkNewPoll(JSON.parse(key) as CreatePollInput).then((result) => {
        if (latestCheck.current === key) setCheck({ key, result });
      });
    }, CHECK_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [step, key, scheduleReady, hasCheck]);

  function update(patch: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...patch }));
    setCreateIssues([]);
  }

  function go(to: number) {
    window.history.pushState(null, "", stepHref(to));
    document.getElementById("new-poll-steps")?.scrollIntoView({ block: "start" });
  }

  function next() {
    setAttempted((s) => new Set(s).add(step));
    if (stepIssues(draft, step).length > 0) return;
    if (step < SCHEDULE_STEP) return go(step + 1);
    startTransition(async () => {
      if (step === SCHEDULE_STEP) {
        const result = current ?? (await runCheck(input, key));
        if (result.ok) go(REVIEW_STEP);
        return;
      }
      const result = await createNewPoll(input);
      if (!result.ok) setCreateIssues(result.issues);
    });
  }

  // Errors: the step's own checks once Continue was pressed, then createPoll's.
  const serverIssues = [...(current && !current.ok ? current.issues : []), ...createIssues];
  const errors: Record<string, string> = {};
  const problems: string[] = [];
  if (attempted.has(step)) {
    for (const issue of stepIssues(draft, step)) errors[issue.field] ??= issue.message;
  }
  for (const issue of serverIssues) {
    const owner = stepOfPath(issue.path);
    const field = FIELD_OF_PATH[issue.path.split(".")[0] ?? ""];
    if (owner === step && field && !errors[field]) errors[field] = withPeriod(issue.message);
    else if (owner === step || step === REVIEW_STEP) problems.push(`${owner === step ? "" : `${STEPS[owner]}: `}${withPeriod(issue.message)}`);
  }

  const fieldsProps = { draft, update, errors };
  const fields: ReactNode[] = [
    <OptionsFields key="options" {...fieldsProps} />,
    <MethodFields key="method" {...fieldsProps} />,
    <RulesFields key="rules" {...fieldsProps} />,
    <AccessFields key="access" {...fieldsProps} />,
    <ScheduleFields key="schedule" {...fieldsProps} zones={zones} timeZone={timeZone} browserZone={browserZone} check={okCheck} />,
    <div key="review" className="grid gap-5">
      <Summary draft={draft} timeZone={timeZone} check={okCheck} upTo={REVIEW_STEP} onEdit={go} />
      <ScheduleWarnings
        warnings={okCheck?.warnings ?? []}
        opensAtLocal={input.opensAtLocal}
        closesAtLocal={input.closesAtLocal}
        opensAt={okCheck?.opensAt ?? null}
        closesAt={okCheck?.closesAt ?? null}
        timeZone={timeZone}
      />
    </div>,
  ];

  // Every field is controlled, so typing before hydration would be lost: show the frame until then.
  if (!ready) return <WizardSkeleton />;

  return (
    <>
      <div id="new-poll-steps" className="scroll-mt-24">
        <Stepper
          label="New poll steps"
          steps={STEPS.map((label, i) => ({ label, href: i < step ? stepHref(i) : undefined }))}
          current={step}
          variant="spread"
          className="mb-7 mt-[18px]"
        />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-[var(--gutter)] min-[1000px]:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <StepFrame
          key={step}
          title={STEP_COPY[step]!.title}
          hint={STEP_COPY[step]!.hint}
          problems={problems}
          onBack={step > 0 ? () => go(step - 1) : undefined}
          onNext={next}
          nextLabel={step === REVIEW_STEP ? "Create poll" : step === SCHEDULE_STEP ? "Continue to review" : "Continue"}
          pending={pending}
          pendingLabel={step === REVIEW_STEP ? "Creating…" : "Checking…"}
          focusHeading={moved}
        >
          {fields[step]}
        </StepFrame>
        <aside aria-label="Your poll so far">
          {step < REVIEW_STEP ? (
            <Paper as="section" aria-labelledby="so-far" padded={false} className="px-6 py-[22px]">
              <h3 id="so-far" className="title mb-3 text-lg text-ink">
                So far
              </h3>
              <Summary draft={draft} timeZone={timeZone} check={okCheck} upTo={step} />
            </Paper>
          ) : null}
          <VoterPreview draft={draft} timeZone={timeZone} check={okCheck} className={step < REVIEW_STEP ? "mt-[var(--gutter)]" : undefined} />
        </aside>
      </div>
    </>
  );
}
