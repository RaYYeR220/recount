import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardHead } from "@/components/dashboard/DashboardHead";
import { Pager } from "@/components/dashboard/Pager";
import { PollFilters, type StatusFilter } from "@/components/dashboard/PollFilters";
import { PollTable } from "@/components/dashboard/PollTable";
import { SheetSkeleton } from "@/components/dashboard/SheetSkeleton";
import { ButtonLink, Callout, EmptyState, Paper } from "@/components/ui";
import { pageParam } from "@/lib/pager";
import { showingText } from "@/lib/pollText";
import { getDb } from "@/server/db/client";
import { listPolls } from "@/server/polls/list";
import type { PollStatus } from "@/server/polls/status";
import { requireViewer } from "@/server/session";

export const metadata: Metadata = { title: "Your polls" };

const PAGE_SIZE = 20;
const STATUSES: readonly PollStatus[] = ["open", "scheduled", "closed"];

type SearchParams = PageProps<"/dashboard">["searchParams"];

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function dashboardHref(q: string, status: StatusFilter, page: number): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/dashboard?${query}` : "/dashboard";
}

async function Dashboard({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const viewer = await requireViewer({ next: "/dashboard" });
  const q = one(params.q).trim();
  const rawStatus = one(params.status);
  const status: StatusFilter = STATUSES.includes(rawStatus as PollStatus) ? (rawStatus as PollStatus) : "";
  const db = getDb();
  const now = new Date();
  const query = { search: q, status: status || undefined, pageSize: PAGE_SIZE };

  const [first, ...byStatus] = await Promise.all([
    listPolls(db, viewer.id, { ...query, page: pageParam(params.page) }, now),
    ...STATUSES.map((s) => listPolls(db, viewer.id, { status: s, pageSize: 1 }, now)),
  ]);
  // A page past the end (after deleting polls, or a hand-edited URL) shows the last one.
  const list = first.items.length === 0 && first.page > first.pageCount ? await listPolls(db, viewer.id, { ...query, page: first.pageCount }, now) : first;

  const counts = byStatus.map((r) => r.total);
  const all = counts.reduce((a, b) => a + b, 0);
  const summary =
    all === 0 ? null : `${all.toLocaleString("en-US")} ${all === 1 ? "poll" : "polls"}: ${STATUSES.map((s, i) => `${counts[i]!.toLocaleString("en-US")} ${s}`).join(", ")}.`;
  const deleted = one(params.deleted) !== "";

  return (
    <>
      <DashboardHead summary={summary} />
      {deleted ? (
        <Callout tone="match" role="status" className="mb-4">
          Poll deleted. Its ballots and invite codes went with it.
        </Callout>
      ) : null}
      <Paper as="section" padded={false} aria-label="Polls" className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3.5 border-b border-paper-3 px-5 py-4 max-[640px]:px-4">
          <PollFilters q={q} status={status} />
          {list.total > 0 ? (
            <p aria-live="polite" className="ml-auto whitespace-nowrap text-sm font-bold text-ink-2 max-[900px]:ml-0">
              {showingText(list.page, PAGE_SIZE, list.items.length, list.total)}
            </p>
          ) : null}
        </div>
        {list.total > 0 ? (
          <>
            <PollTable polls={list.items} />
            <Pager page={list.page} pageCount={list.pageCount} hrefFor={(page) => dashboardHref(q, status, page)} />
          </>
        ) : all === 0 ? (
          <EmptyState
            level={2}
            title="No polls yet"
            description="Ask a question, list the options and share the link. Voters rank by clicking, and you get a count anyone can recount."
            action={
              <ButtonLink href="/new" variant="ink" className="mt-2">
                Start a poll
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            level={2}
            title={q ? `No polls match “${q}”` : "No polls with this status"}
            description={`Search looks at poll titles. Try a shorter word, or clear the filters to see all ${all.toLocaleString("en-US")} polls.`}
            action={
              <ButtonLink href="/dashboard" variant="line" className="mt-2">
                Clear filters
              </ButtonLink>
            }
          />
        )}
      </Paper>
    </>
  );
}

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <div className="wrap page">
      <Suspense
        fallback={
          <>
            <DashboardHead summary={null} />
            <SheetSkeleton />
          </>
        }
      >
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
