import { asc, eq } from "drizzle-orm";
import { findOwnedPoll } from "./authz";
import type { Db } from "./db/client";
import { auditEvent } from "./db/schema";

export type AuditType =
  | "poll.created"
  | "poll.updated"
  | "poll.closed"
  | "poll.deleted"
  | "codes.generated";

export type AuditEntry = {
  type: AuditType;
  actorId: string | null;
  at: Date;
  detail: unknown;
};

/** `detail` describes what changed, never ballot content. */
export async function recordAudit(
  db: Db,
  pollId: string,
  type: AuditType,
  actorId: string | null,
  now: Date,
  detail?: Record<string, unknown>,
): Promise<void> {
  await db.insert(auditEvent).values({ pollId, type, actorId, at: now, detail: detail ?? null });
}

export async function listAudit(db: Db, actorId: string | null, slug: string): Promise<AuditEntry[]> {
  const poll = await findOwnedPoll(db, actorId, slug);
  const rows = await db
    .select({
      type: auditEvent.type,
      actorId: auditEvent.actorId,
      at: auditEvent.at,
      detail: auditEvent.detail,
    })
    .from(auditEvent)
    .where(eq(auditEvent.pollId, poll.id))
    .orderBy(asc(auditEvent.at), asc(auditEvent.id));
  return rows.map((row) => ({ ...row, type: row.type as AuditType }));
}
