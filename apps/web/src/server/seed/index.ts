import { eq } from "drizzle-orm";
import { createAuth } from "../auth";
import type { Db } from "../db/client";
import { user } from "../db/schema";
import { DEMO_PERSONAS } from "../demo";
import { generatedPolls } from "./generated";
import { insertSeedPoll, type SeedPoll } from "./insert";
import { showcasePolls } from "./showcase";

type PersonaKey = (typeof DEMO_PERSONAS)[number]["key"];

/** Personas go through Better Auth so their passwords are hashed the way sign-in expects. */
async function ensurePersonas(db: Db, now: Date): Promise<Record<PersonaKey, string>> {
  const auth = createAuth(db, () => now);
  const ids = {} as Record<PersonaKey, string>;
  for (const persona of DEMO_PERSONAS) {
    const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, persona.email));
    if (existing) {
      ids[persona.key] = existing.id;
      continue;
    }
    const { user: created } = await auth.api.signUpEmail({
      body: { name: persona.name, email: persona.email, password: persona.password },
    });
    ids[persona.key] = created.id;
  }
  return ids;
}

/** Idempotent: personas and polls that already exist (by email and slug) are left as they are. */
export async function seed(db: Db, now: Date): Promise<{ created: number; skipped: number }> {
  const owners = await ensurePersonas(db, now);
  const polls: SeedPoll[] = [...generatedPolls(now), ...showcasePolls(now)];
  let created = 0;
  for (const spec of polls) {
    if (await insertSeedPoll(db, owners[spec.owner], spec, now)) created++;
  }
  return { created, skipped: polls.length - created };
}
