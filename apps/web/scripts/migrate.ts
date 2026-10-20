import { loadEnvConfig } from "@next/env";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { createPool } from "../src/server/db/pool";

async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const pool = createPool(url);
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder: "./drizzle" });
    console.log("Migrations applied");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
