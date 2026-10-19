import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, type Auth } from "./auth";
import { DomainError } from "./errors";

export type Viewer = { id: string; email: string; name: string };

export async function viewerFrom(instance: Auth, requestHeaders: Headers): Promise<Viewer | null> {
  const session = await instance.api.getSession({ headers: requestHeaders });
  if (!session) return null;
  const { id, email, name } = session.user;
  return { id, email, name };
}

export async function getViewer(): Promise<Viewer | null> {
  return viewerFrom(auth, await headers());
}

/**
 * Pages pass `next` to be sent to the login page; route handlers and server
 * actions call it bare and get an `unauthorized` DomainError instead.
 */
export async function requireViewer(options: { next?: string } = {}): Promise<Viewer> {
  const viewer = await getViewer();
  if (viewer) return viewer;
  if (options.next !== undefined) {
    redirect(`/login?next=${encodeURIComponent(options.next)}`);
  }
  throw new DomainError("unauthorized");
}
