import { NextResponse, type NextRequest } from "next/server";
import manifest from "../public/elections/manifest.json";
import { auth } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { resultsHttpStatus } from "@/server/results/httpStatus";
import { viewerFrom } from "@/server/session";

export const config = { matcher: ["/p/:slug/results", "/elections/:slug"] };

/** Marks the proxy's own request for the page, so it is not checked twice. */
const INNER = "x-recount-status-checked";

const ELECTION_SLUGS = new Set(manifest.datasets.map((d) => d.slug));

/** The page as the app renders it (with the matching copy), sent with the status it should have had. */
async function withStatus(req: NextRequest, status: number): Promise<Response> {
  const headers = new Headers({ [INNER]: "1", accept: req.headers.get("accept") ?? "text/html" });
  for (const name of ["cookie", "accept-language", "user-agent"]) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  const page = await fetch(req.url, { headers, redirect: "manual", cache: "no-store" });
  return new NextResponse(page.body, {
    status,
    headers: { "content-type": page.headers.get("content-type") ?? "text/html; charset=utf-8", "cache-control": "private, no-store" },
  });
}

async function resultsStatus(req: NextRequest, slug: string): Promise<number> {
  try {
    const viewer = await viewerFrom(auth, req.headers);
    return await resultsHttpStatus(getDb(), viewer?.id ?? null, slug, new Date());
  } catch (error) {
    console.error("proxy: results status check failed", error instanceof Error ? error.name : typeof error);
    return 200;
  }
}

/**
 * A page streams its static shell before notFound() or forbidden() can run, which
 * fixes the status at 200. For results and replays the answer is known up front
 * (the visibility rule, the replay list), so it is settled here and the page's own
 * copy goes out with a 403 or 404. Client navigations (RSC requests) are left alone.
 */
export async function proxy(req: NextRequest) {
  if (req.headers.has(INNER) || req.headers.has("rsc") || req.headers.has("next-router-prefetch")) return NextResponse.next();
  const [, section, rawSlug = ""] = req.nextUrl.pathname.split("/");
  const slug = decodeURIComponent(rawSlug);
  // Dataset files (/elections/portland-2024-d1.json.gz) are served from public/ as they are.
  if (section === "elections" && slug.includes(".")) return NextResponse.next();
  const status = section === "elections" ? (ELECTION_SLUGS.has(slug) ? 200 : 404) : await resultsStatus(req, slug);
  return status === 200 ? NextResponse.next() : withStatus(req, status);
}
