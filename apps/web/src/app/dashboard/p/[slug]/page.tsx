import type { Metadata } from "next";
import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { AuditLog } from "@/components/dashboard/AuditLog";
import { DeletePoll } from "@/components/dashboard/DeletePoll";
import { InviteCodes } from "@/components/dashboard/InviteCodes";
import { ScheduleSimulator } from "@/components/dashboard/ScheduleSimulator";
import { ShareLink } from "@/components/dashboard/ShareLink";
import { StatusMark } from "@/components/dashboard/StatusMark";
import { VotingControls } from "@/components/dashboard/VotingControls";
import { Badge, ButtonLink, Callout, Chit, PanelHeader, Paper } from "@/components/ui";
import { ACCESS_LABEL, methodLabel, methodLong, plural, presetInfo, RESULTS_LONG, STATUS_LABEL } from "@/lib/pollText";
import { closedAt, scheduleLine } from "@/lib/scheduleText";
import { formatWhen, wallInZone } from "@/lib/when";
import { listAudit } from "@/server/audit";
import { getDb } from "@/server/db/client";
import { DomainError } from "@/server/errors";
import { listInviteCodes, MAX_CODES_PER_REQUEST } from "@/server/polls/codes";
import type { PollDetail } from "@/server/polls/detail";
import { getPollForOwner } from "@/server/polls/get";
import { requireViewer } from "@/server/session";
import { changeClosingTime, closeNow, generateCodes, removePoll } from "./actions";

export const metadata: Metadata = { title: "Manage poll" };

const STATUS_TONE = { open: "match", scheduled: "info", closed: "neutral" } as const;

function Facts({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm">
      {rows.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="text-ink-3">{term}</dt>
          <dd className="m-0 font-bold text-ink [overflow-wrap:anywhere]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function when(date: Date | null, poll: PollDetail): string {
  return date ? formatWhen(date, poll.timeZone) : "—";
}

async function load(slug: string) {
  const viewer = await requireViewer({ next: `/dashboard/p/${slug}` });
  const db = getDb();
  try {
    const poll = await getPollForOwner(db, viewer.id, slug, new Date());
    const [audit, codes] = await Promise.all([
      listAudit(db, viewer.id, slug),
      poll.accessMode === "codes" ? listInviteCodes(db, viewer.id, slug) : Promise.resolve([]),
    ]);
    return { poll, audit, codes };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  }
}

async function Manage({ params, searchParams }: PageProps<"/dashboard/p/[slug]">) {
  const { slug } = await params;
  const query = await searchParams;
  const { poll, audit, codes } = await load(slug);
  const at = typeof query.at === "string" ? query.at : "";
  const created = query.created !== undefined;
  const preset = presetInfo(poll.presetId);
  const used = codes.filter((c) => c.usedAt).length;
  const ended = closedAt(poll);
  const voterPath = `/p/${poll.slug}`;

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/dashboard">Polls</Link>
        <span aria-hidden="true" className="opacity-50">
          /
        </span>
        <span className="[overflow-wrap:anywhere]">{poll.title}</span>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="display page-title [overflow-wrap:anywhere]">{poll.title}</h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone={STATUS_TONE[poll.status]} onDark size="lg" icon={poll.status !== "closed"}>
              {STATUS_LABEL[poll.status]}
            </Badge>
            <Badge tone="neutral" onDark size="lg">
              {methodLabel(poll.seats)}
            </Badge>
            <Badge tone="neutral" onDark size="lg">
              {ACCESS_LABEL[poll.accessMode]}
            </Badge>
            <Badge tone="neutral" onDark size="lg">
              Results: {RESULTS_LONG[poll.resultsVisibility].toLowerCase()}
            </Badge>
            <span className="mono self-center text-sm text-cream-3">{poll.slug}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={voterPath} variant="brass">
            Open the voter page
          </ButtonLink>
          <ButtonLink href={`${voterPath}/results`} variant="line">
            Results
          </ButtonLink>
        </div>
      </div>

      {created ? (
        <Callout tone="match" role="status" className="mt-6">
          <b>Poll created.</b>{" "}
          {poll.accessMode === "codes" ? "Generate invite codes below, then send each voter the link and one code." : "Share the link below with your voters."}
        </Callout>
      ) : null}

      <div className="mt-7 grid items-start gap-[var(--gutter)] lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <div className="grid min-w-0 gap-[var(--gutter)]">
          <Paper as="section" aria-labelledby="turnout-title">
            <PanelHeader id="turnout-title" title="Turnout" description="As of when this page loaded" />
            <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
              <p className="grid">
                <span className="display num text-6xl text-ink">{poll.ballotCount.toLocaleString("en-US")}</span>
                <span className="mt-1 text-sm font-bold text-ink-2">{poll.ballotCount === 1 ? "ballot cast" : "ballots cast"}</span>
              </p>
              {poll.accessMode === "codes" ? (
                <p className="grid">
                  <span className="display num text-4xl text-ink">
                    {used.toLocaleString("en-US")}
                    <span className="text-ink-3"> / {codes.length.toLocaleString("en-US")}</span>
                  </span>
                  <span className="mt-1 text-sm font-bold text-ink-2">invite codes used</span>
                </p>
              ) : null}
              <p className="grid gap-1 text-sm text-ink-2">
                <StatusMark status={poll.status} />
                <span>
                  {scheduleLine(poll, { short: false })} <span className="text-ink-3">({poll.timeZone})</span>
                </span>
              </p>
            </div>
          </Paper>

          <Paper as="section" aria-labelledby="share-title">
            <PanelHeader
              id="share-title"
              title="Share"
              description={poll.accessMode === "codes" ? "Voters open the link and enter their code." : "Anyone with this link can vote once from their browser."}
            />
            <ShareLink path={voterPath} />
          </Paper>

          <Paper as="section" aria-labelledby="schedule-title">
            <PanelHeader id="schedule-title" title="Schedule" description={`All times in ${poll.timeZone}`} />
            <div className="grid gap-6">
              <Facts
                rows={[
                  ["Opens", when(poll.opensAt ?? poll.createdAt, poll)],
                  ["Closes", poll.closesAt ? when(poll.closesAt, poll) : "When you close it"],
                  ...(poll.closedEarlyAt ? ([["Closed early", when(poll.closedEarlyAt, poll)]] as Array<[string, string]>) : []),
                ]}
              />
              <ScheduleSimulator poll={poll} at={at} action={`/dashboard/p/${poll.slug}`} />
              {poll.status === "closed" ? (
                <p className="border-t border-paper-3 pt-5 text-sm text-ink-2">
                  Voting closed {ended ? `on ${when(ended, poll)}` : ""}. The count is final and saved with the poll.
                </p>
              ) : (
                <div className="border-t border-paper-3 pt-5">
                  <VotingControls
                    closeNow={closeNow.bind(null, poll.slug)}
                    changeClosingTime={changeClosingTime.bind(null, poll.slug)}
                    closesText={poll.closesAt ? wallInZone(poll.closesAt, poll.timeZone) : ""}
                    timeZone={poll.timeZone}
                  />
                </div>
              )}
            </div>
          </Paper>

          {poll.accessMode === "codes" ? (
            <InviteCodes codes={codes} generate={poll.status === "closed" ? null : generateCodes.bind(null, poll.slug)} max={MAX_CODES_PER_REQUEST} />
          ) : null}

          <AuditLog entries={audit} timeZone={poll.timeZone} />
        </div>

        <div className="grid min-w-0 gap-[var(--gutter)]">
          <Paper as="section" aria-labelledby="ballot-title">
            <PanelHeader id="ballot-title" title="On the ballot" description={plural(poll.options.length, "option")} />
            <ol className="m-0 grid list-none gap-1.5 p-0">
              {poll.options.map((option) => (
                <li key={option.id} className="flex items-center gap-2.5 rounded-[12px] bg-paper-2 px-3 py-2 font-bold text-ink [overflow-wrap:anywhere]">
                  <Chit index={option.position} size="sm" />
                  {option.label}
                </li>
              ))}
            </ol>
            <p className="mt-3 text-sm text-ink-3">
              {poll.ballotCount > 0 || poll.status === "closed" ? "Options are fixed now that ballots exist." : "Options lock when the first ballot is cast."}
            </p>
          </Paper>

          <Paper as="section" aria-labelledby="settings-title">
            <PanelHeader id="settings-title" title="Settings" />
            <Facts
              rows={[
                ["Method", methodLong(poll.seats)],
                ["Rules", preset?.name ?? poll.presetId],
                ["Voters rank", poll.maxRanks === null ? "As many as they like" : `Up to ${poll.maxRanks}`],
                ["Access", ACCESS_LABEL[poll.accessMode]],
                ["Results", RESULTS_LONG[poll.resultsVisibility]],
                ["Time zone", poll.timeZone],
                ["Created", when(poll.createdAt, poll)],
              ]}
            />
          </Paper>

          <Paper as="section" aria-labelledby="delete-title" className="shadow-[var(--shadow-paper),inset_0_0_0_1.5px_rgb(168_50_31/0.35)]">
            <PanelHeader id="delete-title" title="Delete poll" />
            <DeletePoll slug={poll.slug} action={removePoll.bind(null, poll.slug)} />
          </Paper>
        </div>
      </div>
    </>
  );
}

function ManageSkeleton() {
  return (
    <div aria-label="Loading the poll" className="grid gap-6">
      <div className="h-5 w-40 rounded-chip bg-[rgb(243_239_230/0.08)]" />
      <div className="h-12 w-[min(32rem,80%)] rounded-chip bg-[rgb(243_239_230/0.08)]" />
      <div className="mt-2 grid items-start gap-[var(--gutter)] lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <Paper padded={false} className="h-[420px]">
          <span className="sr-only">Loading…</span>
        </Paper>
        <Paper padded={false} className="h-[300px]">
          <span />
        </Paper>
      </div>
    </div>
  );
}

export default function ManagePollPage(props: PageProps<"/dashboard/p/[slug]">) {
  return (
    <div className="wrap page">
      <Suspense fallback={<ManageSkeleton />}>
        <Manage {...props} />
      </Suspense>
    </div>
  );
}
