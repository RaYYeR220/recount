import { headers } from "next/headers";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { auth } from "@/server/auth";
import { viewerFrom, type Viewer } from "@/server/session";
import { logOut } from "./actions";
import { Disclosure } from "./Disclosure";
import { NavLinks } from "./NavLinks";
import { POLLS_NAV } from "./nav";

/**
 * One session lookup per request for the header and the phone menu, kept from
 * taking the whole header down if auth storage is unreachable. Reading the request
 * headers stays outside the try: that is where prerendering stops.
 */
const viewerOrNull = cache(async (): Promise<Viewer | null> => {
  const requestHeaders = await headers();
  try {
    return await viewerFrom(auth, requestHeaders);
  } catch (error) {
    unstable_rethrow(error);
    console.error("header: session lookup failed", error);
    return null;
  }
});

function initial(viewer: Viewer): string {
  const source = viewer.name.trim() || viewer.email;
  return source.charAt(0).toUpperCase();
}

function LogOutButton() {
  return (
    <form action={logOut}>
      <button type="submit" className="menu-item">
        Log out
      </button>
    </form>
  );
}

/** Right side of the header. Reads the session, so it renders inside <Suspense>. */
export async function HeaderAccount() {
  const viewer = await viewerOrNull();
  if (!viewer) {
    return (
      <>
        <ButtonLink href="/login" variant="line" size="sm">
          Sign in
        </ButtonLink>
        <ButtonLink href="/new" variant="brass" size="sm" className="hide-narrow">
          Start a poll
        </ButtonLink>
      </>
    );
  }
  return (
    <>
      <NavLinks items={[POLLS_NAV]} className="nav-link" />
      <span className="account-email" title={viewer.email}>
        {viewer.email}
      </span>
      <Disclosure
        className="menu menu-avatar"
        summaryLabel={`Account menu for ${viewer.email}`}
        summary={
          <span className="avatar" aria-hidden="true">
            {initial(viewer)}
          </span>
        }
      >
        <div className="menu-panel">
          <p className="menu-who">{viewer.email}</p>
          <Link href="/settings" className="menu-item">
            Settings
          </Link>
          <LogOutButton />
        </div>
      </Disclosure>
    </>
  );
}

/** Account part of the phone menu sheet. Also inside <Suspense>. */
export async function MenuAccount() {
  const viewer = await viewerOrNull();
  if (!viewer) {
    return (
      <div className="menu-actions">
        <ButtonLink href="/new" variant="brass">
          Start a poll
        </ButtonLink>
        <ButtonLink href="/login" variant="line">
          Sign in
        </ButtonLink>
      </div>
    );
  }
  return (
    <nav aria-label="Account">
      <Link href={POLLS_NAV.href} className="menu-item">
        {POLLS_NAV.label}
      </Link>
      <Link href="/settings" className="menu-item">
        Settings
      </Link>
      <LogOutButton />
      <p className="mt-3 text-sm text-cream-3 [overflow-wrap:anywhere]">Signed in as {viewer.email}</p>
    </nav>
  );
}
