import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Db } from "@/server/db/client";
import * as schema from "@/server/db/schema";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

export async function createTestDb(): Promise<Db> {
  const db = drizzle({ client: new PGlite(), schema });
  await migrate(db, { migrationsFolder });
  return db;
}
