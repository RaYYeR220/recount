"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { getDb } from "@/server/db/client";
import { DomainError } from "@/server/errors";
import { createPoll } from "@/server/polls/create";
import { previewPoll } from "@/server/polls/preview";
import type { ScheduleWarning } from "@/server/polls/schedule";
import type { CreatePollInput } from "@/server/polls/schema";
import { requireViewer } from "@/server/session";
import type { Issue } from "@/server/validation";

export type PollCheck =
  | { ok: true; warnings: ScheduleWarning[]; opensAt: Date | null; closesAt: Date | null }
  | { ok: false; issues: Issue[] };

function failure(error: unknown): PollCheck {
  unstable_rethrow(error);
  if (error instanceof DomainError && error.code === "validation") {
    return { ok: false, issues: (error.details as { issues: Issue[] }).issues };
  }
  if (error instanceof DomainError && error.code === "unauthorized") {
    return { ok: false, issues: [{ path: "", message: "Your session ended. Sign in again in another tab, then try once more." }] };
  }
  throw error;
}

/**
 * Runs createPoll without keeping the poll, so the wizard shows its own validation
 * and its DST warnings before anything is created.
 */
export async function checkNewPoll(input: CreatePollInput): Promise<PollCheck> {
  try {
    const viewer = await requireViewer();
    const preview = await previewPoll(getDb(), viewer.id, input, new Date());
    return { ok: true, warnings: preview.warnings, opensAt: preview.opensAt, closesAt: preview.closesAt };
  } catch (error) {
    return failure(error);
  }
}

/** Creates the poll and opens its manage page; returns the issues when it can't. */
export async function createNewPoll(input: CreatePollInput): Promise<PollCheck> {
  let slug: string;
  try {
    const viewer = await requireViewer();
    slug = (await createPoll(getDb(), viewer.id, input, new Date())).slug;
  } catch (error) {
    return failure(error);
  }
  redirect(`/dashboard/p/${slug}?created=1`);
}
