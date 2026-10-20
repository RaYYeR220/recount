import { Pool } from "@neondatabase/serverless";
import { loadEnvConfig } from "@next/env";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "../src/server/db/schema";
import { seed } from "../src/server/seed";

async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const pool = new Pool({ connectionString: url });
  try {
    const { created, skipped } = await seed(drizzle({ client: pool, schema }), new Date());
    console.log(`Seeded ${created} polls, ${skipped} already present`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
