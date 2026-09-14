import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { FREQUENT_LOOKBACK_BATCHES, FREQUENT_ORDER_THRESHOLD } from "@shared/signup-throttle";

type AppDatabase =
  | NeonHttpDatabase<typeof schema>
  | NodePgDatabase<typeof schema>
  | NodePgDatabase<Record<string, unknown>>;

/** True if phone has ≥3 non-cancelled orders across the last 6 batches. */
export async function isFrequentCustomer(
  db: AppDatabase,
  phone10: string,
): Promise<boolean> {
  const recentBatches = await db
    .select({ id: schema.batches.id })
    .from(schema.batches)
    .orderBy(desc(schema.batches.serviceDate), desc(schema.batches.batchNumber))
    .limit(FREQUENT_LOOKBACK_BATCHES);

  if (recentBatches.length === 0) {
    return false;
  }

  const batchIds = recentBatches.map((b) => b.id);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.orders)
    .innerJoin(schema.customers, eq(schema.orders.customerId, schema.customers.id))
    .where(
      and(
        eq(schema.customers.phone, phone10),
        inArray(schema.orders.batchId, batchIds),
        sql`${schema.orders.status} <> 'cancelled'`,
      ),
    );

  return (row?.n ?? 0) >= FREQUENT_ORDER_THRESHOLD;
}
