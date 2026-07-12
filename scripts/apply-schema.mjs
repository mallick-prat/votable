// Applies scripts/schema.sql to the Neon database.
// Usage: npm run db:push
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (run with --env-file=.env.local)");
  process.exit(1);
}

const sql = neon(url);
const schema = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "schema.sql"),
  "utf8",
);

const statements = schema
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

for (const stmt of statements) {
  await sql.query(stmt);
}
console.log(`Applied ${statements.length} statements.`);
