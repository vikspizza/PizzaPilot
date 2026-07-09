import { readFileSync } from "node:fs";
import pg from "pg";

function loadDevVars() {
  try {
    const content = readFileSync(".dev.vars", "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // optional
  }
}

async function main() {
  loadDevVars();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set (or present in .dev.vars)");
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query("BEGIN");

    const columnCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'user_id'
    `);

    if (columnCheck.rowCount && columnCheck.rowCount > 0) {
      await client.query(`ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_user_id_users_id_fk`);
      await client.query(`DROP INDEX IF EXISTS idx_orders_user_id`);
      await client.query(`ALTER TABLE orders DROP COLUMN user_id`);
      console.log("Dropped orders.user_id column");
    } else {
      console.log("orders.user_id does not exist — nothing to drop");
    }

    await client.query("COMMIT");
    console.log("Migration complete: removed orders.user_id");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
