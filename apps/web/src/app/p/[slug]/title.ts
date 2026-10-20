import { cacheLife } from "next/cache";
import { findPoll } from "@/server/authz";
import { getDb } from "@/server/db/client";
import { DomainError } from "@/server/errors";

/** A poll's title for the tab, cached for a few minutes; null when there is no such poll. */
export async function pollTitle(slug: string): Promise<string | null> {
  "use cache";
  cacheLife("minutes");
  try {
    return (await findPoll(getDb(), slug)).title;
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") return null;
    throw error;
  }
}
