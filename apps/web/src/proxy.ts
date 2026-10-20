import { NextResponse, type NextRequest } from "next/server";
import manifest from "../public/elections/manifest.json";
import { auth } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { managePageStatus, voterPageStatus } from "@/server/polls/httpStatus";
import { resultsHttpStatus } from "@/server/results/httpStatus";
import { viewerFrom } from "@/server/session";

export const config = {
  matcher: [
    "/p/:slug",
    "/p/:slug/results",
    "/p/:slug/verify",
    "/p/:slug/receipt",
    "/elections/:slug",
    "/dashboard",
    "/dashboard/p/:slug",
    "/new",
    "/settings",
  ],
};

const ELECTION_SLUGS = new Set(manifest.datasets.map((d) => d.slug));

/** Prerendered status pages: each answers with its own status and the matching copy. */
const POLL_NOT_FOUND = "/status/poll-not-found";
const MANAGE_NOT_FOUND = "/status/manage-not-found";
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

const rewrite = (req: NextRequest, path: string) => NextResponse.rewrite(new URL(path, req.url));

/** The status a page should answer with; 200 lets the page render as usual. */
async function decide(req: NextRequest, parts: string[]): Promise<NextResponse> {
  const [section, segment = "", child] = parts;
  if (section === "elections") {
    const slug = slugOf(segment);
    // Dataset files (/elections/portland-2024-d1.json.gz) are served from public/ as they are.
    if (slug?.includes(".")) return NextResponse.next();
    return slug && ELECTION_SLUGS.has(slug) ? NextResponse.next() : rewrite(req, PAGE_NOT_FOUND);
  }

  const viewer = await viewerFrom(auth, req.headers);
  if (section === "p") {
    const slug = slugOf(segment);
    if (!slug) return rewrite(req, POLL_NOT_FOUND);
    if (child === "results") {
      const status = await resultsHttpStatus(getDb(), viewer?.id ?? null, slug, new Date());
      if (status === 404) return rewrite(req, POLL_NOT_FOUND);
      if (status === 403) return rewrite(req, RESULTS_HIDDEN);
      return NextResponse.next();
    }
    return (await voterPageStatus(getDb(), slug)) === 404 ? rewrite(req, POLL_NOT_FOUND) : NextResponse.next();
  }

  // Organiser pages: signed out goes to the login page, someone else's poll is a 404.
  if (!viewer) {
    const login = new URL("/login", req.url);
    login.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(login, 307);
  }
  const slug = section === "dashboard" && segment === "p" ? slugOf(child ?? "") : undefined;
  if (slug === undefined) return NextResponse.next();
  if (!slug) return rewrite(req, MANAGE_NOT_FOUND);
  return (await managePageStatus(getDb(), viewer.id, slug)) === 404 ? rewrite(req, MANAGE_NOT_FOUND) : NextResponse.next();
}

/**
 * A page streams its static shell before notFound() or forbidden() can run, which
 * fixes the status at 200. For poll pages, results and replays the answer is known
 * up front (the slug, its owner, the visibility rule, the replay list), so it is
 * settled here by rewriting to a page prerendered with that status. Client
 * navigations (RSC requests) are left to the pages, which render the same copy.
 */
export async function proxy(req: NextRequest) {
  if (req.headers.has("rsc") || req.headers.has("next-router-prefetch")) return NextResponse.next();
  try {
    return await decide(req, req.nextUrl.pathname.split("/").slice(1));
  } catch (error) {
    // The pages run the same checks and still render the right copy, only with a 200.
    console.error("proxy: status check failed", error instanceof Error ? error.name : typeof error);
    return NextResponse.next();
  }
}
