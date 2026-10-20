import type { Metadata } from "next";
import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BallotHead } from "@/components/ballot/BallotHead";
import { VerifyForm } from "@/components/ballot/VerifyForm";
import { getDb } from "@/server/db/client";
import { DomainError } from "@/server/errors";
import { getPublicPoll } from "@/server/polls/get";
import { verifyReceipt } from "../actions";

export const metadata: Metadata = { title: "Check your ballot" };

async function Verify({ params }: { params: PageProps<"/p/[slug]/verify">["params"] }) {
  const { slug } = await params;
  await connection();
  let poll;
  try {
    poll = await getPublicPoll(getDb(), slug, new Date());
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  }
  return (
    <>
      <BallotHead id="verify-title" title="Check your ballot" description={`Enter the receipt you got after voting in “${poll.title}”. You'll see your ranking exactly as it was recorded.`} />
      <div className="mt-6">
        <VerifyForm check={verifyReceipt.bind(null, poll.slug)} labels={poll.options.map((o) => o.label)} timeZone={poll.timeZone} />
      </div>
      <p className="mt-7 border-t border-paper-3 pt-4 text-sm text-ink-3">
        A receipt shows one ballot&apos;s ranking and nothing about who cast it.{" "}
        <Link href={`/p/${poll.slug}`} className="font-bold text-ink-2 underline underline-offset-4">
          Back to the poll
        </Link>
      </p>
    </>
  );
}

export default function VerifyPage({ params }: PageProps<"/p/[slug]/verify">) {
  return (
    <div className="wrap page">
      <section aria-labelledby="verify-title" className="paper gilt-frame mx-auto max-w-[980px] px-[18px] pb-6 pt-[22px] sm:px-[38px] sm:pb-8 sm:pt-[34px]">
        <Suspense fallback={<div className="h-[260px]" aria-label="Loading" />}>
          <Verify params={params} />
        </Suspense>
      </section>
    </div>
  );
}
