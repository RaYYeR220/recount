import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { loginHref } from "@/lib/safeNext";
import { auth } from "@/server/auth";
import { findOwnedPoll, findPoll } from "@/server/authz";
import { getDb } from "@/server/db/client";
import { DomainError } from "@/server/errors";
import { viewerFrom } from "@/server/session";

const SIGNED_IN_ONLY = /^\/(dashboard|new|settings)(\/|$)/;
const MANAGE = /^\/dashboard\/p\/([^/]+)\/?$/;
const VOTER = /^\/p\/([^/]+)(\/verify|\/receipt)?\/?$/;

/**
 * Pages stream from a prerendered shell, which fixes the status at 200 before a
 * page can call notFound(). So the checks that decide between a page and a 404 run
 * here first: a poll that doesn't exist, or a manage page that isn't the viewer's,
 * is rewritten to the poll's `unavailable` page, prerendered as a real 404. The
 * pages still check again; this only gets the status code right.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const toLogin = () => NextResponse.redirect(new URL(loginHref(`${pathname}${search}`), request.url));

  if (SIGNED_IN_ONLY.test(pathname) && !getSessionCookie(request)) return toLogin();

  const manage = MANAGE.exec(pathname);
  const voter = manage ? null : VOTER.exec(pathname);
  if (!manage && !voter) return NextResponse.next();

  const segment = (manage ?? voter)![1]!;
  try {
    const slug = decodeURIComponent(segment);
    if (manage) {
      const viewer = await viewerFrom(auth, request.headers);
      if (!viewer) return toLogin();
      await findOwnedPoll(getDb(), viewer.id, slug);
    } else {
      await findPoll(getDb(), slug);
    }
    return NextResponse.next();
  } catch (error) {
    if ((error instanceof DomainError && error.code === "not_found") || error instanceof URIError) {
      const base = manage ? "/dashboard/p" : "/p";
      return NextResponse.rewrite(new URL(`${base}/${segment}/unavailable`, request.url));
    }
    // Storage trouble: let the page render and report it.
    console.error("proxy: poll check failed", error instanceof Error ? error.name : typeof error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*", "/new", "/settings", "/p/:slug", "/p/:slug/verify", "/p/:slug/receipt"],
};
