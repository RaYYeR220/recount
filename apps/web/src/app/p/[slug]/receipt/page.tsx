import type { Metadata } from "next";
import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { RankedList } from "@/components/ballot/RankedList";
import { VotingSteps } from "@/components/ballot/VotingSteps";
import { CopyButton } from "@/components/CopyButton";
import { Badge, ButtonLink, Paper } from "@/components/ui";
import { lookupReceipt } from "@/server/ballots/receipt";
import { getDb } from "@/server/db/client";
import { DomainError } from "@/server/errors";
import { getPublicPoll } from "@/server/polls/get";
import { readFlashedReceipt } from "../voterCookies";

export const metadata: Metadata = { title: "Your receipt" };

/** The torn edge at the foot of a receipt. */
function Stub() {
  return (
    <div
      aria-hidden="true"
      className="mx-[-1px] h-4 bg-[radial-gradient(circle_at_8px_-2px,var(--color-walnut-700)_7px,transparent_7.5px)] bg-[length:16px_16px] bg-repeat-x"
    />
  );
}

async function Receipt({ params }: { params: PageProps<"/p/[slug]/receipt">["params"] }) {
  const { slug } = await params;
  await connection();
  const receipt = await readFlashedReceipt();
  const db = getDb();
  let poll;
  try {
    poll = await getPublicPoll(db, slug, new Date());
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  }
  const found = receipt
    ? await lookupReceipt(db, slug, receipt).catch((error: unknown) => {
        if (error instanceof DomainError && error.code === "not_found") return null;
        throw error;
      })
    : null;
  const index = new Map(poll.options.map((o, i) => [o.label, i]));

  if (!receipt || !found) {
    return (
      <Paper as="section" aria-labelledby="receipt-title" padded={false} className="grid justify-items-center gap-3.5 px-6 pb-8 pt-9 text-center">
        <h1 id="receipt-title" className="title text-[clamp(28px,3vw,36px)] text-ink">
          Receipts are shown once
        </h1>
        <p className="max-w-[48ch] text-ink-2">
          A receipt appears right after you cast a ballot, and stays on this page for a few minutes. If you saved yours, check it on the poll&apos;s check page.
        </p>
        <div className="mt-1.5 flex flex-wrap justify-center gap-3">
          <ButtonLink href={`/p/${slug}/verify`} variant="ink">
            Check your ballot
          </ButtonLink>
          <ButtonLink href={`/p/${slug}`} variant="line">
            Back to ballot
          </ButtonLink>
        </div>
      </Paper>
    );
  }

  return (
    <>
      <Paper as="section" aria-labelledby="receipt-title" padded={false} className="overflow-hidden">
        <div className="grid justify-items-center gap-3.5 px-6 pb-7 pt-9 text-center">
          <Badge tone="match">Ballot cast</Badge>
          <h1 id="receipt-title" className="title text-[clamp(30px,3vw,40px)] text-ink">
            Your receipt
          </h1>
          <p className="mono rounded-card bg-well px-[18px] py-3.5 text-[clamp(24px,7vw,40px)] font-semibold tracking-[0.04em] text-ink shadow-[inset_0_0_0_1.5px_var(--color-ink),0_0_0_6px_var(--color-paper-2)] sm:px-[26px] sm:py-4">
            <span className="sr-only">Receipt code </span>
            <span data-testid="receipt-code">{receipt}</span>
          </p>
          <p className="max-w-[48ch] text-ink-2">
            Keep this code. Enter it on the poll&apos;s check page to see your ranking exactly as it was recorded and counted. It doesn&apos;t say who you are.
          </p>
          <RankedList ranking={found.ranking.map((label) => ({ label, index: index.get(label) ?? 0 }))} className="mt-1 w-auto justify-items-center [&>li]:min-w-[9rem]" />
          <div className="mt-1.5 flex flex-wrap justify-center gap-3">
            <CopyButton text={receipt} done="Receipt copied.">
              Copy receipt
            </CopyButton>
            <ButtonLink href={`/p/${slug}/verify`} variant="ink">
              Check your ballot
            </ButtonLink>
          </div>
          <p className="text-sm text-ink-3">For {poll.title}</p>
        </div>
        <Stub />
      </Paper>
      <p className="mt-[18px] text-center text-sm text-cream-3">
        <Link href={`/p/${slug}`} className="font-bold text-cream-2 underline underline-offset-4">
          Back to ballot
        </Link>
      </p>
    </>
  );
}

export default function ReceiptPage({ params }: PageProps<"/p/[slug]/receipt">) {
  return (
    <div className="wrap page">
      <div className="mx-auto max-w-[980px]">
        <VotingSteps current={2} />
        <Suspense
          fallback={
            <Paper padded={false} className="h-[480px]" aria-label="Loading your receipt">
              <span className="sr-only">Loading…</span>
            </Paper>
          }
        >
          <Receipt params={params} />
        </Suspense>
      </div>
    </div>
  );
}
