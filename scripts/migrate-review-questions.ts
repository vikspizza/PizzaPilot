import { readFileSync } from "node:fs";
import pg from "pg";
import { requireDatabaseUrl } from "./load-env";

async function main() {
  const databaseUrl = requireDatabaseUrl();

  const statements = readFileSync("migrations/0002_review_questions_answers.sql", "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    for (const [i, stmt] of statements.entries()) {
      console.log(`Running statement ${i + 1}/${statements.length}...`);
      await client.query(stmt);
    }
    console.log("Migration 0002_review_questions_answers applied");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
