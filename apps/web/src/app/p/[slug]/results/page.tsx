import type { PresetId } from "@recount/engine";
import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, notFound, unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { AuditLinks } from "@/components/results/AuditLinks";
import type { CountView } from "@/components/results/model";
import { pollFacts } from "@/components/results/pollFacts";
import { ResultsLayout } from "@/components/results/ResultsLayout";
import { WinnerCard } from "@/components/results/WinnerCard";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { EmptyState } from "@/components/ui/EmptyState";
import { Paper } from "@/components/ui/Surface";
import { buildCountScene } from "@/lib/countScene";
import { findPoll } from "@/server/authz";
import { getDb } from "@/server/db/client";
import { DomainError } from "@/server/errors";
import type { PollRow } from "@/server/polls/detail";
import { closedSince } from "@/server/polls/status";
import { getResults, type PollResults } from "@/server/results/get";
import { canSeeResults } from "@/server/results/visibility";
import { getViewer, type Viewer } from "@/server/session";
import "@/styles/results.css";

/** The page waits for the visibility check, so a hidden or private poll answers 403 or 404. */
export const instant = false;

const DESCRIPTION = "Round-by-round results with the cast-vote record, its SHA-256 and a recount that runs in the browser.";

async function viewerOrNull(): Promise<Viewer | null> {
  try {
    return await getViewer();
  } catch (error) {
    unstable_rethrow(error);
    console.error("results: session lookup failed", error);
    return null;
  }
}

type Loaded =
  | { kind: "ok"; viewer: Viewer | null; now: Date; results: PollResults; poll: PollRow }
  | { kind: "denied"; code: "not_found" | "hidden_until_close" };

/** One visibility check per request, shared by the page and its metadata. */
const load = cache(async (slug: string): Promise<Loaded> => {
  const viewer = await viewerOrNull();
  await connection();
  const now = new Date();
  try {
    const results = await getResults(getDb(), viewer?.id ?? null, slug, now);
    // Only read once getResults has said this viewer may see the results.
    return { kind: "ok", viewer, now, results, poll: await findPoll(getDb(), slug) };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof DomainError && (error.code === "not_found" || error.code === "hidden_until_close")) return { kind: "denied", code: error.code };
    throw error;
  }
});

export async function generateMetadata({ params }: PageProps<"/p/[slug]/results">): Promise<Metadata> {
  const loaded = await load((await params).slug);
  return { title: loaded.kind === "ok" ? `${loaded.poll.title}: results` : "Poll results", description: DESCRIPTION };
}

export default async function ResultsPage({ params }: PageProps<"/p/[slug]/results">) {
  const { slug } = await params;
  const loaded = await load(slug);
  if (loaded.kind === "denied") {
    if (loaded.code === "not_found") notFound();
    forbidden();
  }
  const { viewer, now, results, poll } = loaded;

  const isOwner = viewer !== null && viewer.id === poll.ownerId;
  const isPublic = canSeeResults(poll, null, now) === "yes";
  const closed = results.status === "closed";
  const empty = results.totalBallots === 0;
  const seedSource = "seeded from the cast-vote record's SHA-256";
  const view: CountView = {
    rounds: results.rounds,
    options: results.candidates,
    winners: results.winners,
    seats: results.seats,
    totalBallots: results.totalBallots,
    pairwise: results.pairwise,
    pluralityWinner: results.pluralityWinner,
    rules: results.rules,
  };
  const facts = pollFacts({
    status: results.status,
    timeZone: poll.timeZone,
    opensAt: poll.opensAt,
    closesAt: poll.closesAt,
    closedAt: closedSince(poll, now),
    seats: poll.seats,
    presetId: poll.presetId,
    ballots: results.totalBallots,
    resultsVisibility: poll.resultsVisibility,
  });

  return (
    <div className="wrap page">
      <nav className="crumbs" aria-label="Breadcrumb">
        {isOwner ? (
          <>
            <Link href="/dashboard">Polls</Link>
            <span aria-hidden="true">/</span>
          </>
        ) : null}
        <Link href={`/p/${encodeURIComponent(slug)}`}>{slug}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Results</span>
      </nav>

      <div className="res-head">
        <div className="min-w-0">
          <h1 className="display page-title">{poll.title}</h1>
          {poll.description ? <p className="page-desc">{poll.description}</p> : null}
          <div className="meta-row">
            {facts.map((f) => (
              <Badge key={f} onDark>
                {f}
              </Badge>
            ))}
          </div>
        </div>
        {empty ? null : <WinnerCard view={view} provisional={!closed} />}
      </div>

      {isOwner && !isPublic ? (
        <Callout tone="info" className="res-note">
          <b>Only you can see this.</b>{" "}
          {poll.resultsVisibility === "owner_only"
            ? "This poll's results are shown to its organiser only; everyone else gets a page that says it doesn't exist."
            : "Everyone else sees these results once the poll closes."}
        </Callout>
      ) : null}
      {!closed && !empty ? (
        <Callout tone="info" className="res-note">
          <b>The poll is still open.</b> This is the count so far; it can change with every ballot until the poll closes.
        </Callout>
      ) : null}

      {empty ? (
        <Paper className="max-w-[720px]">
          <EmptyState
            level={2}
            title="No ballots yet."
            description={
              results.status === "scheduled"
                ? "Voting hasn't started, so there is nothing to count."
                : closed
                  ? "This poll closed without a single ballot, so there is nothing to count."
                  : "The count appears here, round by round, as soon as the first ballot is cast."
            }
            action={
              results.status === "open" ? (
                <ButtonLink href={`/p/${encodeURIComponent(slug)}`} variant="ink">
                  Go to the ballot
                </ButtonLink>
              ) : undefined
            }
          />
        </Paper>
      ) : (
        <ResultsLayout
          view={view}
          scene={buildCountScene({
            rounds: results.rounds,
            options: results.candidates,
            seats: results.seats,
            provisional: !closed,
            tiebreak: { rules: results.rules, seed: seedSource },
          })}
          title={`${poll.title}: the count, round by round`}
          seedSource={seedSource}
          provisional={!closed}
          side={
            <AuditLinks
              slug={slug}
              sha256={results.cvrSha256}
              ballots={results.totalBallots}
              access={!isPublic ? "private" : closed ? "public-closed" : "public-open"}
              recount={{
                presetId: poll.presetId as PresetId,
                seats: poll.seats,
                maxRanks: poll.maxRanks,
                candidates: results.candidates,
                winners: results.winners,
                rounds: results.rounds,
              }}
            />
          }
        />
      )}
    </div>
  );
}
