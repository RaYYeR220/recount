import { NextResponse, type NextRequest } from "next/server";
import manifest from "../public/elections/manifest.json";
import { auth } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { resultsHttpStatus } from "@/server/results/httpStatus";
import { viewerFrom } from "@/server/session";

export const config = { matcher: ["/p/:slug/results", "/elections/:slug"] };

const ELECTION_SLUGS = new Set(manifest.datasets.map((d) => d.slug));

/** Prerendered status pages: each answers with its own status and the matching copy. */
const POLL_NOT_FOUND = "/status/poll-not-found";
const RESULTS_HIDDEN = "/status/results-hidden";
/** No route lives here, so the app's own 404 page answers. */
const PAGE_NOT_FOUND = "/status/page-not-found";

function slugOf(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

async function resultsStatus(req: NextRequest, slug: string): Promise<number> {
  try {
    const viewer = await viewerFrom(auth, req.headers);
    return await resultsHttpStatus(getDb(), viewer?.id ?? null, slug, new Date());
  } catch (error) {
    // The page runs the same check and still renders the right copy, only with a 200.
    console.error("proxy: results status check failed", error instanceof Error ? error.name : typeof error);
    return 200;
  }
}

const rewrite = (req: NextRequest, path: string) => NextResponse.rewrite(new URL(path, req.url));

/**
 * A page streams its static shell before notFound() or forbidden() can run, which
 * fixes the status at 200. For results and replays the answer is known up front
 * (the visibility rule, the replay list), so it is settled here by rewriting to a
 * page prerendered with that status. Client navigations (RSC requests) are left to
 * the page, which renders the same copy.
 */
export async function proxy(req: NextRequest) {
  if (req.headers.has("rsc") || req.headers.has("next-router-prefetch")) return NextResponse.next();
  const [, section, segment = ""] = req.nextUrl.pathname.split("/");
  const slug = slugOf(segment);
  if (section === "elections") {
    // Dataset files (/elections/portland-2024-d1.json.gz) are served from public/ as they are.
    if (slug?.includes(".")) return NextResponse.next();
    return slug && ELECTION_SLUGS.has(slug) ? NextResponse.next() : rewrite(req, PAGE_NOT_FOUND);
  }
  if (!slug) return rewrite(req, POLL_NOT_FOUND);
  const status = await resultsStatus(req, slug);
  if (status === 404) return rewrite(req, POLL_NOT_FOUND);
  if (status === 403) return rewrite(req, RESULTS_HIDDEN);
  return NextResponse.next();
}
