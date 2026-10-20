import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import { STEPS } from "@/components/wizard/draft";
import { Wizard } from "@/components/wizard/Wizard";
import { Paper, Stepper } from "@/components/ui";
import { requireViewer } from "@/server/session";

export const metadata: Metadata = { title: "New poll" };

/** Every zone the poll services accept, UTC first, then by name. */
async function timeZones(): Promise<string[]> {
  "use cache";
  cacheLife("max");
  return ["UTC", ...Intl.supportedValuesOf("timeZone").filter((zone) => zone !== "UTC").sort()];
}

async function WizardGate() {
  await requireViewer({ next: "/new" });
  return <Wizard zones={await timeZones()} />;
}

/** The first step's frame while the session is read. */
function WizardSkeleton() {
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

export default function NewPollPage() {
  return (
    <div className="wrap page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/dashboard">Polls</Link>
        <span aria-hidden="true" className="opacity-50">
          /
        </span>
        <span>New poll</span>
      </nav>
      <h1 className="display page-title">New poll</h1>
      <Suspense fallback={<WizardSkeleton />}>
        <WizardGate />
      </Suspense>
    </div>
  );
}
