import { findOwnedPoll, findPoll } from "../authz";
import type { Db } from "../db/client";
import { DomainError } from "../errors";

/** 404 for a slug with no poll behind it; voter pages exist for every poll. */
export async function voterPageStatus(db: Db, slug: string): Promise<200 | 404> {
  return (await exists(() => findPoll(db, slug))) ? 200 : 404;
}

/** 404 unless the viewer owns the poll: someone else's poll looks like no poll at all. */
export async function managePageStatus(db: Db, viewerId: string, slug: string): Promise<200 | 404> {
  return (await exists(() => findOwnedPoll(db, viewerId, slug))) ? 200 : 404;
}

async function exists(find: () => Promise<unknown>): Promise<boolean> {
  try {
    await find();
    return true;
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") return false;
    throw error;
  }
}
