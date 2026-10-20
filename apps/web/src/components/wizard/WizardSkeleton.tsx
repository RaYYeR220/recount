import { Paper, Stepper } from "@/components/ui";
import { STEPS } from "./draft";

/** The wizard's frame before it can be used: while the session is read, and until hydrated. */
export function WizardSkeleton() {
  return (
    <>
      <Stepper label="New poll steps" steps={STEPS.map((label) => ({ label }))} current={0} variant="spread" className="mb-7 mt-[18px]" />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-[var(--gutter)] min-[1000px]:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <Paper padded={false} className="h-[560px]" aria-label="Loading the new poll form">
          <span className="sr-only">Loading…</span>
        </Paper>
        <Paper padded={false} className="h-40">
          <span />
        </Paper>
      </div>
    </>
  );
}
