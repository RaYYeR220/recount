import type { Metadata } from "next";
import { notFound, unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Ballot, type BallotProps } from "@/components/ballot/Ballot";
import { CodeGate } from "@/components/ballot/CodeGate";
import { ALREADY_VOTED, NOT_STARTED } from "@/components/ballot/copy";
import { PollNotice } from "@/components/ballot/PollNotice";
import { ViewerTime } from "@/components/ballot/ViewerTime";
import { VotingSteps } from "@/components/ballot/VotingSteps";
import { ButtonLink, Paper } from "@/components/ui";
import { closedAt } from "@/lib/scheduleText";
import { formatWhen } from "@/lib/when";
import { findVoterBallot } from "@/server/ballots/voter";
import { getDb } from "@/server/db/client";
import { DomainError } from "@/server/errors";
import { getPublicPoll, type PublicPoll } from "@/server/polls/get";
import { castVote, enterCode } from "./actions";
import { pollTitle } from "./title";
import { readVoterToken } from "./voterCookies";

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  return { title: (await pollTitle((await params).slug)) ?? "Poll" };
}

async function loadPoll(slug: string): Promise<PublicPoll> {
  try {
    return await getPublicPoll(getDb(), slug, new Date());
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  }
}

function resultsLink(poll: PublicPoll) {
  return (
    <ButtonLink href={`/p/${poll.slug}/results`} variant="brass">
      See the results
    </ButtonLink>
  );
}

function checkLink(poll: PublicPoll) {
  return (
    <ButtonLink href={`/p/${poll.slug}/verify`} variant="line">
      Check your ballot
    </ButtonLink>
  );
}

async function Voter({ params }: { params: PageProps<"/p/[slug]">["params"] }) {
  const { slug } = await params;
  await connection();
  const voterToken = await readVoterToken();
  const poll = await loadPoll(slug);
  const tz = poll.timeZone;
  const labels = poll.options.map((o) => o.label);
  const common = { title: poll.title, description: poll.description };

  if (poll.status === "scheduled") {
    const opens = poll.opensAt!;
    return (
      <PollNotice {...common} headline={NOT_STARTED} options={labels}>
        <p>
          Opens <b className="text-ink">{formatWhen(opens, tz)}</b> ({tz})
          <ViewerTime at={opens} pollZone={tz} />
        </p>
        {poll.closesAt ? (
          <p>
            Closes {formatWhen(poll.closesAt, tz)} ({tz})
          </p>
        ) : null}
        <p className="text-sm text-ink-3">Come back to this link then; the ballot appears here when voting opens.</p>
      </PollNotice>
    );
  }

  if (poll.status === "closed") {
    const ended = closedAt(poll);
    return (
      <PollNotice
        {...common}
        headline="Voting is over."
        options={labels}
        actions={
          <>
            {poll.resultsVisibility === "owner_only" ? null : resultsLink(poll)}
            {checkLink(poll)}
          </>
        }
      >
        {ended ? (
          <p>
            This poll closed at {formatWhen(ended, tz)} ({tz}). No more ballots are taken.
          </p>
        ) : null}
        {poll.resultsVisibility === "owner_only" ? <p>The organizer keeps the results private.</p> : <p>The count is final, and anyone can recount it.</p>}
      </PollNotice>
    );
  }

  const ballot: BallotProps = {
    ...common,
    options: poll.options,
    maxRanks: poll.maxRanks,
    seats: poll.seats,
    when: { lead: "Open now", time: poll.closesAt ? `Closes ${formatWhen(poll.closesAt, tz)}` : "No closing time set", timeZone: tz },
    cast: castVote.bind(null, poll.slug),
  };

  if (poll.accessMode === "codes") return <CodeGate {...ballot} enter={enterCode.bind(null, poll.slug)} />;

  if (await findVoterBallot(getDb(), poll.slug, voterToken)) {
    return (
      <PollNotice
        {...common}
        when={ballot.when}
        headline={ALREADY_VOTED}
        actions={
          <>
            {poll.resultsVisibility === "live" ? resultsLink(poll) : null}
            {checkLink(poll)}
          </>
        }
      >
        <p>Ballots are final, so yours can&apos;t be changed. Your receipt shows it was recorded exactly as you cast it.</p>
        {poll.resultsVisibility === "after_close" ? <p>The results appear once voting closes.</p> : null}
      </PollNotice>
    );
  }

  return <Ballot {...ballot} />;
}

function BallotSkeleton() {
  return (
    <div className="mx-auto max-w-[980px]">
      <VotingSteps current={0} />
      <Paper frame padded={false} className="h-[560px]" aria-label="Loading the ballot">
        <span className="sr-only">Loading the ballot…</span>
      </Paper>
    </div>
  );
}

export default function VoterPage({ params }: PageProps<"/p/[slug]">) {
  return (
    <div className="wrap page">
      <Suspense fallback={<BallotSkeleton />}>
        <Voter params={params} />
      </Suspense>
    </div>
  );
}
