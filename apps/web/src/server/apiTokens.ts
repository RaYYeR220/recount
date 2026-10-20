import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "./db/client";
import { apiToken } from "./db/schema";
import { DomainError } from "./errors";
import { ID_ALPHABET, randomString } from "./ids";
import { validationError } from "./validation";

const TOKEN_SHAPE = new RegExp(`^rk_[${ID_ALPHABET}]{32}$`);
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ApiTokenSummary = {
  id: string;
  name: string;
  createdAt: Date;
  lastUsedAt: Date | null;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** The token is returned once; only its sha256 is stored. */
export async function createApiToken(
  db: Db,
  userId: string,
  name: string,
  now: Date,
): Promise<{ token: string }> {
  const label = name.trim();
  if (label.length < 1 || label.length > 60) {
    throw validationError({ path: "name", message: "Name the token in 1 to 60 characters" });
  }
  const token = `rk_${randomString(32)}`;
  await db.insert(apiToken).values({ userId, name: label, tokenHash: hashToken(token), createdAt: now });
  return { token };
}

export function listApiTokens(db: Db, userId: string): Promise<ApiTokenSummary[]> {
  return db
    .select({
      id: apiToken.id,
      name: apiToken.name,
      createdAt: apiToken.createdAt,
      lastUsedAt: apiToken.lastUsedAt,
    })
    .from(apiToken)
    .where(eq(apiToken.userId, userId))
    .orderBy(desc(apiToken.createdAt));
}

export async function revokeApiToken(db: Db, userId: string, tokenId: string): Promise<void> {
  if (!UUID_SHAPE.test(tokenId)) throw new DomainError("not_found");
  const removed = await db
    .delete(apiToken)
    .where(and(eq(apiToken.id, tokenId), eq(apiToken.userId, userId)))
    .returning({ id: apiToken.id });
  if (removed.length === 0) throw new DomainError("not_found");
}

export async function authenticateApiToken(
  db: Db,
  authorizationHeader: string | null,
  now: Date,
): Promise<{ userId: string } | null> {
  const token = /^Bearer\s+(\S+)$/i.exec(authorizationHeader?.trim() ?? "")?.[1];
  if (!token || !TOKEN_SHAPE.test(token)) return null;
  const [row] = await db
    .update(apiToken)
    .set({ lastUsedAt: now })
    .where(eq(apiToken.tokenHash, hashToken(token)))
    .returning({ userId: apiToken.userId });
  return row ? { userId: row.userId } : null;
}
