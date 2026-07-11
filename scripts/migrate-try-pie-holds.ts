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
      CREATE TABLE IF NOT EXISTS try_pie_holds (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        batch_id varchar NOT NULL,
        pizza_id varchar NOT NULL,
        expires_at timestamp NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);

    // Ephemeral 60s reservations only — old pie-level holds have no valid slot_id.
    await client.query(`TRUNCATE try_pie_holds`);

    await client.query(`
      ALTER TABLE try_pie_holds ADD COLUMN IF NOT EXISTS date text
    `);
    await client.query(`
      ALTER TABLE try_pie_holds ADD COLUMN IF NOT EXISTS service_date text
    `);
    await client.query(`
      ALTER TABLE try_pie_holds ADD COLUMN IF NOT EXISTS slot_id varchar
    `);

    await client.query(`
      UPDATE try_pie_holds
      SET service_date = date
      WHERE service_date IS NULL AND date IS NOT NULL
    `);

    await client.query(`DELETE FROM try_pie_holds WHERE service_date IS NULL OR slot_id IS NULL`);

    await client.query(`
      DELETE FROM try_pie_holds h
      WHERE NOT EXISTS (
        SELECT 1 FROM pickup_slots ps WHERE ps.slot_id = h.slot_id
      )
    `);

    await client.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'try_pie_holds' AND column_name = 'date'
        ) THEN
          ALTER TABLE try_pie_holds DROP COLUMN date;
        END IF;
      END $$
    `);

    await client.query(`
      ALTER TABLE try_pie_holds ALTER COLUMN service_date SET NOT NULL
    `);
    await client.query(`
      ALTER TABLE try_pie_holds ALTER COLUMN slot_id SET NOT NULL
    `);

    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'try_pie_holds_batch_id_batches_id_fk'
        ) THEN
          ALTER TABLE try_pie_holds
            ADD CONSTRAINT try_pie_holds_batch_id_batches_id_fk
            FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE;
        END IF;
      END $$
    `);

    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'try_pie_holds_pizza_id_pizzas_id_fk'
        ) THEN
          ALTER TABLE try_pie_holds
            ADD CONSTRAINT try_pie_holds_pizza_id_pizzas_id_fk
            FOREIGN KEY (pizza_id) REFERENCES pizzas(id);
        END IF;
      END $$
    `);

    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'try_pie_holds_slot_id_pickup_slots_slot_id_fk'
        ) THEN
          ALTER TABLE try_pie_holds
            ADD CONSTRAINT try_pie_holds_slot_id_pickup_slots_slot_id_fk
            FOREIGN KEY (slot_id) REFERENCES pickup_slots(slot_id);
        END IF;
      END $$
    `);

    await client.query(`DROP INDEX IF EXISTS idx_try_pie_holds_batch_date_slot`);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_try_pie_holds_batch_pizza
      ON try_pie_holds(batch_id, pizza_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_try_pie_holds_batch_date_slot
      ON try_pie_holds(batch_id, service_date, slot_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_try_pie_holds_expires_at
      ON try_pie_holds(expires_at)
    `);

    await client.query("COMMIT");
    console.log("Migration complete: try_pie_holds slot reservations");
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
