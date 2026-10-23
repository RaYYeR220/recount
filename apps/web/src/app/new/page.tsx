import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import { Wizard } from "@/components/wizard/Wizard";
import { WizardSkeleton } from "@/components/wizard/WizardSkeleton";
import { zoneChoices } from "@/lib/timeZones";
import { requireViewer } from "@/server/session";

export const metadata: Metadata = { title: "New poll" };

/** Every zone the poll services accept, under its IANA name, UTC first, then by name. */
async function timeZones(): Promise<string[]> {
  "use cache";
  cacheLife("max");
  return zoneChoices(Intl.supportedValuesOf("timeZone"));
}

async function WizardGate() {
  await requireViewer({ next: "/new" });
  return <Wizard zones={await timeZones()} />;
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
