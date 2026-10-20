import { authenticateApiToken } from "../apiTokens";
import { getDb, type Db } from "../db/client";
import { DomainError } from "../errors";

export type ApiDeps = { db: () => Db; now: () => Date };

export const liveDeps: ApiDeps = { db: getDb, now: () => new Date() };

export async function requireApiUser(db: Db, req: Request, now: Date): Promise<string> {
  const caller = await authenticateApiToken(db, req.headers.get("authorization"), now);
  if (!caller) throw new DomainError("unauthorized");
  return caller.userId;
}

/** Anonymous without an Authorization header; a header that does not authenticate is a 401. */
export async function optionalApiUser(db: Db, req: Request, now: Date): Promise<string | null> {
  if (!req.headers.has("authorization")) return null;
  return requireApiUser(db, req, now);
}

/** The client address as set by Vercel's edge, which callers cannot spoof. */
export function clientIp(req: Request): string {
  for (const header of ["x-vercel-forwarded-for", "x-real-ip"]) {
    const value = req.headers.get(header)?.split(",")[0]?.trim();
    if (value) return value;
  }
  return "unknown";
}
