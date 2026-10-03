import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import {
  FREQUENT_LOOKBACK_BATCHES,
  FREQUENT_ORDER_THRESHOLD,
  SIGNUP_PRIORITY_WINDOW_MS,
} from "@shared/signup-throttle";

type AppDatabase =
  | NeonHttpDatabase<typeof schema>
  | NodePgDatabase<typeof schema>
  | NodePgDatabase<Record<string, unknown>>;

export type FrequentCustomerRow = {
  customerId: string;
  name: string;
  phone: string;
  orderCount: number;
};

export type FrequentCustomersReport = {
  threshold: number;
  lookbackBatches: number;
  priorityWindowMinutes: number;
  customers: FrequentCustomerRow[];
};

async function recentBatchIds(db: AppDatabase): Promise<string[]> {
  const recentBatches = await db
    .select({ id: schema.batches.id })
    .from(schema.batches)
    .orderBy(desc(schema.batches.serviceDate), desc(schema.batches.batchNumber))
    .limit(FREQUENT_LOOKBACK_BATCHES);

  return recentBatches.map((batch) => batch.id);
}

function emptyFrequentCustomersReport(): FrequentCustomersReport {
  return {
    threshold: FREQUENT_ORDER_THRESHOLD,
    lookbackBatches: FREQUENT_LOOKBACK_BATCHES,
    priorityWindowMinutes: SIGNUP_PRIORITY_WINDOW_MS / 60_000,
    customers: [],
  };
}

/** True if phone has ≥3 non-cancelled orders across the last 6 batches. */
export async function isFrequentCustomer(
  db: AppDatabase,
  phone10: string,
): Promise<boolean> {
  const batchIds = await recentBatchIds(db);
  if (batchIds.length === 0) {
    return false;
  }
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

/** Customers who signup will hold back during a batch's priority window. */
export async function listFrequentCustomers(
  db: AppDatabase,
): Promise<FrequentCustomersReport> {
  const batchIds = await recentBatchIds(db);
  if (batchIds.length === 0) {
    return emptyFrequentCustomersReport();
  }

  const rows = await db
    .select({
      customerId: schema.customers.id,
      name: schema.customers.name,
      phone: schema.customers.phone,
      orderCount: sql<number>`count(*)::int`,
    })
    .from(schema.orders)
    .innerJoin(schema.customers, eq(schema.orders.customerId, schema.customers.id))
    .where(
      and(
        inArray(schema.orders.batchId, batchIds),
        sql`${schema.orders.status} <> 'cancelled'`,
      ),
    )
    .groupBy(schema.customers.id, schema.customers.name, schema.customers.phone)
    .having(sql`count(*) >= ${FREQUENT_ORDER_THRESHOLD}`)
    .orderBy(asc(schema.customers.name));

  return {
    ...emptyFrequentCustomersReport(),
    customers: rows.map((row) => ({
      customerId: row.customerId,
      name: row.name,
      phone: row.phone,
      orderCount: Number(row.orderCount),
    })),
  };
}
