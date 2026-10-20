import { findPoll } from "../authz";
import type { Db } from "../db/client";
import { DomainError } from "../errors";
import { canSeeResults } from "./visibility";

export type ResultsHttpStatus = 200 | 403 | 404;

/**
 * The status a results page answers with, from the visibility rule alone: 404 for
 * a poll that does not exist or is not shared with the viewer, 403 for results
 * hidden until close. The page itself renders the matching copy.
 */
export async function resultsHttpStatus(db: Db, viewerId: string | null, slug: string, now: Date): Promise<ResultsHttpStatus> {
  try {
    const access = canSeeResults(await findPoll(db, slug), viewerId, now);
    return access === "yes" ? 200 : access === "not_found" ? 404 : 403;
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") return 404;
    throw error;
  }
}
