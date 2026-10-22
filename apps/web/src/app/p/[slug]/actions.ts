"use server";

import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { ALREADY_VOTED, NOT_STARTED } from "@/components/ballot/copy";
import { formatWhen } from "@/lib/when";
import { clientIpFrom } from "@/server/authLimits";
import { castBallot } from "@/server/ballots/cast";
import { checkInviteCode } from "@/server/ballots/gate";
import { lookupReceipt } from "@/server/ballots/receipt";
import { findVoterBallot } from "@/server/ballots/voter";
import { getDb } from "@/server/db/client";
import { DomainError } from "@/server/errors";
import { getPublicPoll } from "@/server/polls/get";
import { checkRateLimit, LIMITS } from "@/server/rateLimit";
import type { Issue } from "@/server/validation";
import { ensureVoterToken, flashReceipt } from "./voterCookies";

/** A second submit of the same ballot within this window gets the same receipt back. */
const SAME_BALLOT_MS = 2 * 60_000;

/** Per-IP limits; without an address (local development) there is nothing to key on. */
async function limit(kind: "cast" | "code" | "receipt", slug: string): Promise<void> {
  const ip = clientIpFrom(await headers());
  if (!ip) return;
  const { limit: max, windowSeconds } = kind === "receipt" ? LIMITS.receiptLookup : LIMITS.castBallot;
  await checkRateLimit(getDb(), `${kind}:${ip}:${slug}`, max, windowSeconds, new Date());
}

async function closedMessage(slug: string, closedAt: Date | null | undefined): Promise<string> {
  if (!closedAt) return "This poll has closed.";
  // The poll can be deleted between the failed cast and this lookup.
  const timeZone = await getPublicPoll(getDb(), slug, new Date()).then(
    (p) => p.timeZone,
    () => null,
  );
  return timeZone ? `This poll closed at ${formatWhen(closedAt, timeZone)} (${timeZone}).` : "This poll has closed.";
}

/** Words for the errors a voter can run into. */
async function voterMessage(error: unknown, slug: string): Promise<string> {
  unstable_rethrow(error);
  if (!(error instanceof DomainError)) throw error;
  switch (error.code) {
    case "code_invalid":
      return "That code isn't valid for this poll.";
    case "code_used":
      return "This code has already been used.";
    case "code_required":
      return "Enter the invite code you were sent.";
    case "already_voted":
      return ALREADY_VOTED;
    case "poll_not_open":
      return NOT_STARTED;
    case "poll_closed":
      return closedMessage(slug, (error.details as { closedAt?: Date | null } | undefined)?.closedAt);
    case "rate_limited":
      return "Too many tries from your network. Wait a minute, then try again.";
    case "not_found":
      return "This poll doesn't exist or isn't shared with you.";
    case "validation":
      return (error.details as { issues: Issue[] }).issues.map((i) => i.message).join(". ") + ".";
    default:
      return "That didn't work. Reload the page and try again.";
  }
}

export type CodeState = { code?: string; error?: string; typed?: string };

/** Checks an invite code before the voter ranks; casting is what uses it up. */
export async function enterCode(slug: string, _prev: CodeState, form: FormData): Promise<CodeState> {
  const typed = String(form.get("code") ?? "");
  try {
    await limit("code", slug);
    return { code: await checkInviteCode(getDb(), slug, typed, new Date()) };
  } catch (error) {
    return { error: await voterMessage(error, slug), typed };
  }
}

export type CastState = { error?: string; alreadyVoted?: boolean };

/**
 * Casts the ballot and goes to the receipt. Safe to send twice: the second ballot
 * from the same browser is refused by the database, and a refusal that comes right
 * after this browser's own ballot leads to that ballot's receipt.
 */
export async function castVote(slug: string, _prev: CastState, form: FormData): Promise<CastState> {
  const ranking = form.getAll("ranking").map(String);
  const code = String(form.get("code") ?? "");
  let receipt: string;
  try {
    await limit("cast", slug);
    const voterToken = await ensureVoterToken();
    try {
      receipt = (await castBallot(getDb(), { slug, ranking, code: code || undefined, voterToken }, new Date())).receipt;
    } catch (error) {
      if (!(error instanceof DomainError && error.code === "already_voted")) throw error;
      const mine = await findVoterBallot(getDb(), slug, voterToken);
      if (!mine || Date.now() - mine.castAt.getTime() > SAME_BALLOT_MS) return { error: ALREADY_VOTED, alreadyVoted: true };
      receipt = mine.receipt;
    }
  } catch (error) {
    return { error: await voterMessage(error, slug) };
  }
  await flashReceipt(slug, receipt);
  redirect(`/p/${slug}/receipt`);
}

export type VerifyState = { receipt?: string; ranking?: string[]; castAt?: Date; error?: string };

/** The ballot a receipt points to, exactly as recorded. */
export async function verifyReceipt(slug: string, _prev: VerifyState, form: FormData): Promise<VerifyState> {
  const receipt = String(form.get("receipt") ?? "").trim();
  if (!receipt) return { error: "Enter the receipt code from your ballot, like 7kq2-m9xd-4hp8." };
  try {
    await limit("receipt", slug);
    const found = await lookupReceipt(getDb(), slug, receipt);
    return { receipt, ranking: found.ranking, castAt: found.castAt };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof DomainError && error.code === "not_found") {
      return { receipt, error: "No ballot in this poll has that receipt. Check each character and try again." };
    }
    return { receipt, error: await voterMessage(error, slug) };
  }
}
