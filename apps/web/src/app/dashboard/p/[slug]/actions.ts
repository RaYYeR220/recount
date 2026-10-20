"use server";

import { refresh } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { parseWallInput, scheduleWarningText } from "@/lib/when";
import { getDb } from "@/server/db/client";
import { DomainError } from "@/server/errors";
import { closePoll } from "@/server/polls/close";
import { generateInviteCodes, MAX_CODES_PER_REQUEST } from "@/server/polls/codes";
import { deletePoll } from "@/server/polls/remove";
import { updatePoll } from "@/server/polls/update";
import { requireViewer } from "@/server/session";
import type { Issue } from "@/server/validation";

export type ManageState = { ok?: string; error?: string; warnings?: string[] };

function message(error: unknown): ManageState {
  unstable_rethrow(error);
  if (!(error instanceof DomainError)) throw error;
  switch (error.code) {
    case "validation": {
      const issues = (error.details as { issues: Issue[] }).issues;
      return { error: issues.map((i) => (/[.!?]$/.test(i.message) ? i.message : `${i.message}.`)).join(" ") };
    }
    case "poll_closed":
      return { error: "This poll is closed, so that can't change any more." };
    case "schedule_locked":
      return { error: "That part of the schedule can't change any more." };
    case "unauthorized":
      return { error: "Your session ended. Sign in again, then try once more." };
    case "not_found":
      return { error: "This poll doesn't exist or isn't shared with you." };
    default:
      return { error: "That didn't work. Reload the page and try again." };
  }
}

export async function closeNow(slug: string): Promise<ManageState> {
  try {
    const viewer = await requireViewer();
    await closePoll(getDb(), viewer.id, slug, new Date());
  } catch (error) {
    return message(error);
  }
  refresh();
  return { ok: "Voting is closed. The count and the CVR hash are saved with the poll." };
}

export async function changeClosingTime(slug: string, _prev: ManageState, form: FormData): Promise<ManageState> {
  const text = String(form.get("closes") ?? "").trim();
  const local = text === "" ? null : parseWallInput(text);
  if (text !== "" && !local) return { error: "Use the format YYYY-MM-DD HH:mm, for example 2027-03-14 09:00." };
  let warnings: string[];
  try {
    const viewer = await requireViewer();
    const poll = await updatePoll(getDb(), viewer.id, slug, { closesAtLocal: local }, new Date());
    warnings = poll.warnings.map((w) => scheduleWarningText(w, local!, poll.timeZone, poll.closesAt!));
  } catch (error) {
    return message(error);
  }
  refresh();
  return { ok: local ? "Closing time saved." : "The poll now stays open until you close it.", warnings };
}

export async function generateCodes(slug: string, _prev: ManageState, form: FormData): Promise<ManageState> {
  const count = Number(form.get("count"));
  if (!Number.isInteger(count) || count < 1 || count > MAX_CODES_PER_REQUEST) {
    return { error: `Generate between 1 and ${MAX_CODES_PER_REQUEST} codes at a time.` };
  }
  let created: number;
  try {
    const viewer = await requireViewer();
    created = (await generateInviteCodes(getDb(), viewer.id, slug, count, new Date())).created;
  } catch (error) {
    return message(error);
  }
  refresh();
  return { ok: `${created.toLocaleString("en-US")} new ${created === 1 ? "code" : "codes"} added.` };
}

export async function removePoll(slug: string, _prev: ManageState, form: FormData): Promise<ManageState> {
  if (String(form.get("confirm") ?? "").trim() !== slug) return { error: `Type ${slug} exactly to confirm.` };
  try {
    const viewer = await requireViewer();
    await deletePoll(getDb(), viewer.id, slug, new Date());
  } catch (error) {
    return message(error);
  }
  redirect("/dashboard?deleted=1");
}
