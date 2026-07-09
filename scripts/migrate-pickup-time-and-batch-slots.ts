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

    await client.query(`
      ALTER TABLE batches ADD COLUMN IF NOT EXISTS slot_list_id varchar
    `);

    await client.query(`
      UPDATE batches
      SET slot_list_id = (
        SELECT slot_list_id FROM slot_lists WHERE active_yorn = true LIMIT 1
      )
      WHERE slot_list_id IS NULL
    `);

    await client.query(`
      UPDATE batches
      SET slot_list_id = (
        SELECT slot_list_id FROM slot_lists ORDER BY created_at LIMIT 1
      )
      WHERE slot_list_id IS NULL
    `);

    const pickupColumnCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'pickup_slots'
        AND column_name IN ('pickup_time_mil', 'pickup_time')
    `);
    const pickupColumns = new Set(pickupColumnCheck.rows.map((row) => row.column_name as string));

    if (pickupColumns.has("pickup_time") && !pickupColumns.has("pickup_time_mil")) {
      console.log("pickup_slots.pickup_time migration already applied.");
    } else {
      await client.query(`
        ALTER TABLE pickup_slots ADD COLUMN IF NOT EXISTS pickup_time time
      `);

      if (pickupColumns.has("pickup_time_mil")) {
        await client.query(`
          UPDATE pickup_slots
          SET pickup_time = (
            to_char(
              to_timestamp(pickup_time_mil / 1000.0) AT TIME ZONE 'America/Los_Angeles',
              'HH24:MI:SS'
            )::time
          )
          WHERE pickup_time IS NULL
        `);

        await client.query(`ALTER TABLE pickup_slots DROP COLUMN pickup_time_mil`);
      }

      await client.query(`ALTER TABLE pickup_slots ALTER COLUMN pickup_time SET NOT NULL`);
    }

    await client.query(`DROP INDEX IF EXISTS idx_pickup_slots_pickup_time_mil`);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pickup_slots_pickup_time ON pickup_slots(pickup_time)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_batches_slot_list_id ON batches(slot_list_id)
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'batches_slot_list_id_slot_lists_slot_list_id_fk'
        ) THEN
          ALTER TABLE batches
            ADD CONSTRAINT batches_slot_list_id_slot_lists_slot_list_id_fk
            FOREIGN KEY (slot_list_id) REFERENCES slot_lists(slot_list_id)
            ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END $$
    `);

    await client.query("COMMIT");
    console.log("Migration complete: pickup_time + batches.slot_list_id");
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
