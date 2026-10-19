import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let cached: Db | undefined;

export function getDb(): Db {
  cached ??= drizzle({
    client: new Pool({ connectionString: process.env.DATABASE_URL }),
    schema,
  });
  return cached;
}
