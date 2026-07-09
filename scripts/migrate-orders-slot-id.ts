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
    // .dev.vars is optional when DATABASE_URL is already set
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
      WHERE table_name = 'orders' AND column_name IN ('time_slot', 'slot_id')
    `);
    const columns = new Set(columnCheck.rows.map((row) => row.column_name as string));

    if (columns.has("slot_id") && !columns.has("time_slot")) {
      console.log("Migration already applied: orders.slot_id exists, time_slot removed.");
      await client.query("ROLLBACK");
      return;
    }

    if (!columns.has("time_slot")) {
      throw new Error("Expected orders.time_slot column for migration");
    }

    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS slot_id varchar`);

    await client.query(`
      UPDATE orders
      SET slot_id = time_slot
      WHERE slot_id IS NULL
        AND time_slot ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    `);

    await client.query(`
      UPDATE orders o
      SET slot_id = ps.slot_id
      FROM pickup_slots ps
      WHERE o.slot_id IS NULL
        AND o.time_slot ~ '^\\d{1,2}:\\d{2}$'
        AND to_char(
          to_timestamp(ps.pickup_time_mil / 1000.0) AT TIME ZONE 'America/Los_Angeles',
          'YYYY-MM-DD'
        ) = o.date
        AND to_char(
          to_timestamp(ps.pickup_time_mil / 1000.0) AT TIME ZONE 'America/Los_Angeles',
          'HH24:MI'
        ) = CASE
          WHEN o.time_slot ~ '^\\d:\\d{2}$' THEN '0' || o.time_slot
          ELSE o.time_slot
        END
    `);

    const unmappable = await client.query(`
      SELECT id, date, time_slot FROM orders WHERE slot_id IS NULL
    `);

    if (unmappable.rowCount && unmappable.rowCount > 0) {
      console.log(`Deleting ${unmappable.rowCount} orders that could not be mapped to pickup_slots:`);
      for (const row of unmappable.rows) {
        console.log(`  - ${row.id} (${row.date} ${row.time_slot})`);
      }
      await client.query(`DELETE FROM orders WHERE slot_id IS NULL`);
    }

    await client.query(`ALTER TABLE orders DROP COLUMN IF EXISTS time_slot`);
    await client.query(`ALTER TABLE orders ALTER COLUMN slot_id SET NOT NULL`);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'orders_slot_id_pickup_slots_slot_id_fk'
        ) THEN
          ALTER TABLE orders
            ADD CONSTRAINT orders_slot_id_pickup_slots_slot_id_fk
            FOREIGN KEY (slot_id) REFERENCES pickup_slots(slot_id)
            ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_slot_id ON orders(slot_id)
    `);

    await client.query("COMMIT");
    console.log("Migration complete: orders.time_slot -> orders.slot_id");
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
