/**
 * Seed DEV data to test signup priority throttle.
 *
 * Frequent phone (blocked during first 30m after Activate): 5551112222
 * Newcomer phone (allowed immediately): 5553334444
 *
 * Orders are placed on older batches in the lookback window (not the newest
 * upcoming batch), using each batch's real pizza from batch_pizzas.
 *
 * Usage: npx tsx scripts/seed-frequent-customer-test.ts
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema";
import { requireDatabaseUrl } from "./load-env";
import {
  FREQUENT_LOOKBACK_BATCHES,
  FREQUENT_ORDER_THRESHOLD,
} from "../shared/signup-throttle";

const FREQUENT_PHONE = "5551112222";
const NEWCOMER_PHONE = "5553334444";

async function upsertCustomer(
  db: ReturnType<typeof drizzle<typeof schema>>,
  phone: string,
  name: string,
  email: string,
) {
  const [existing] = await db
    .select()
    .from(schema.customers)
    .where(eq(schema.customers.phone, phone))
    .limit(1);
  if (existing) {
    const [updated] = await db
      .update(schema.customers)
      .set({ name, email })
      .where(eq(schema.customers.id, existing.id))
      .returning();
    return updated;
  }
  const [created] = await db
    .insert(schema.customers)
    .values({ phone, name, email })
    .returning();
  return created;
}

async function main() {
  const url = requireDatabaseUrl();
  const pool = new pg.Pool({ connectionString: url });
  const db = drizzle(pool, { schema });

  const recentBatches = await db
    .select()
    .from(schema.batches)
    .orderBy(desc(schema.batches.serviceDate), desc(schema.batches.batchNumber))
    .limit(FREQUENT_LOOKBACK_BATCHES);

  if (recentBatches.length < FREQUENT_ORDER_THRESHOLD + 1) {
    throw new Error(
      `Need at least ${FREQUENT_ORDER_THRESHOLD + 1} batches in DEV; found ${recentBatches.length}.`,
    );
  }

  const [slot] = await db.select().from(schema.pickupSlots).limit(1);
  if (!slot) {
    throw new Error("No pickup slots found in DEV.");
  }

  const frequent = await upsertCustomer(
    db,
    FREQUENT_PHONE,
    "Frequent Tester",
    "frequent-tester@example.com",
  );
  const newcomer = await upsertCustomer(
    db,
    NEWCOMER_PHONE,
    "Newcomer Tester",
    "newcomer-tester@example.com",
  );

  // Remove any prior seed orders for these phones (all batches)
  await db.delete(schema.orders).where(
    inArray(schema.orders.customerId, [frequent.id, newcomer.id]),
  );

  // Skip newest batch so they can still try signing up for it
  const olderInWindow = recentBatches.slice(1);
  const seeded: Array<{ batchNumber: number; pizzaName: string }> = [];

  for (const batch of olderInWindow) {
    if (seeded.length >= FREQUENT_ORDER_THRESHOLD) {
      break;
    }
    const [batchPizza] = await db
      .select({
        pizzaId: schema.batchPizzas.pizzaId,
        pizzaName: schema.pizzas.name,
      })
      .from(schema.batchPizzas)
      .innerJoin(schema.pizzas, eq(schema.batchPizzas.pizzaId, schema.pizzas.id))
      .where(eq(schema.batchPizzas.batchId, batch.id))
      .limit(1);

    if (!batchPizza) {
      continue;
    }

    await db.insert(schema.orders).values({
      customerId: frequent.id,
      batchId: batch.id,
      pizzaId: batchPizza.pizzaId,
      quantity: 1,
      type: "pickup",
      date: batch.serviceDate,
      slotId: slot.slotId,
      status: "confirmed",
    });
    seeded.push({ batchNumber: batch.batchNumber, pizzaName: batchPizza.pizzaName });
  }

  if (seeded.length < FREQUENT_ORDER_THRESHOLD) {
    throw new Error(
      `Could only seed ${seeded.length} orders (need ${FREQUENT_ORDER_THRESHOLD}). Add pizzas to more older batches.`,
    );
  }

  const batchIds = recentBatches.map((b) => b.id);
  const [countRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.orders)
    .innerJoin(schema.customers, eq(schema.orders.customerId, schema.customers.id))
    .where(
      and(
        eq(schema.customers.phone, FREQUENT_PHONE),
        inArray(schema.orders.batchId, batchIds),
        sql`${schema.orders.status} <> 'cancelled'`,
      ),
    );

  console.log("Seeded frequent-customer test data on DEV:");
  console.log(`  Frequent phone: ${FREQUENT_PHONE} (${countRow?.n ?? 0} orders in last ${FREQUENT_LOOKBACK_BATCHES} batches)`);
  for (const row of seeded) {
    console.log(`    - Batch #${row.batchNumber}: ${row.pizzaName}`);
  }
  console.log(`  Newcomer phone: ${NEWCOMER_PHONE} (0 orders)`);
  console.log(`  Left newest batch #${recentBatches[0].batchNumber} clear for signup testing.`);
  console.log("");
  console.log("Test steps:");
  console.log(`  1. Activate batch #${recentBatches[0].batchNumber}.`);
  console.log("  2. Try a Pie within 30 minutes.");
  console.log(`  3. ${FREQUENT_PHONE} → wait message; ${NEWCOMER_PHONE} → allowed.`);

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
