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
