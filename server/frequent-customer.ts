import { and, asc, desc, eq, inArray, lt, lte, or, sql } from "drizzle-orm";
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

export type FrequentWindowBatch = {
  batchNumber: number;
  serviceDate: string;
};

export type FrequentCustomersReport = {
  threshold: number;
  lookbackBatches: number;
  priorityWindowMinutes: number;
  anchorBatchNumber: number | null;
  windowBatches: FrequentWindowBatch[];
  customers: FrequentCustomerRow[];
};

type WindowBatchRow = FrequentWindowBatch & { id: string };

async function recentBatchIds(db: AppDatabase): Promise<string[]> {
  const recentBatches = await db
    .select({ id: schema.batches.id })
    .from(schema.batches)
    .orderBy(desc(schema.batches.serviceDate), desc(schema.batches.batchNumber))
    .limit(FREQUENT_LOOKBACK_BATCHES);

  return recentBatches.map((batch) => batch.id);
}

/** The selected batch plus older batches, newest first, capped at the lookback size. */
async function batchesThrough(
  db: AppDatabase,
  anchorBatchId: string,
): Promise<WindowBatchRow[] | null> {
  const [anchor] = await db
    .select({
      id: schema.batches.id,
      batchNumber: schema.batches.batchNumber,
      serviceDate: schema.batches.serviceDate,
    })
    .from(schema.batches)
    .where(eq(schema.batches.id, anchorBatchId))
    .limit(1);

  if (!anchor) {
    return null;
  }

  return db
    .select({
      id: schema.batches.id,
      batchNumber: schema.batches.batchNumber,
      serviceDate: schema.batches.serviceDate,
    })
    .from(schema.batches)
    .where(
      or(
        lt(schema.batches.serviceDate, anchor.serviceDate),
        and(
          eq(schema.batches.serviceDate, anchor.serviceDate),
          lte(schema.batches.batchNumber, anchor.batchNumber),
        ),
      ),
    )
    .orderBy(desc(schema.batches.serviceDate), desc(schema.batches.batchNumber))
    .limit(FREQUENT_LOOKBACK_BATCHES);
}

function emptyFrequentCustomersReport(): FrequentCustomersReport {
  return {
    threshold: FREQUENT_ORDER_THRESHOLD,
    lookbackBatches: FREQUENT_LOOKBACK_BATCHES,
    priorityWindowMinutes: SIGNUP_PRIORITY_WINDOW_MS / 60_000,
    anchorBatchNumber: null,
    windowBatches: [],
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
  anchorBatchId: string,
): Promise<FrequentCustomersReport | null> {
  const windowBatches = await batchesThrough(db, anchorBatchId);
  if (!windowBatches) {
    return null;
  }
  const batchIds = windowBatches.map((batch) => batch.id);
  if (batchIds.length === 0) {
    return {
      ...emptyFrequentCustomersReport(),
      anchorBatchNumber: null,
      windowBatches: [],
    };
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
    anchorBatchNumber: windowBatches[0]?.batchNumber ?? null,
    windowBatches: windowBatches.map(({ batchNumber, serviceDate }) => ({
      batchNumber,
      serviceDate,
    })),
    customers: rows.map((row) => ({
      customerId: row.customerId,
      name: row.name,
      phone: row.phone,
      orderCount: Number(row.orderCount),
    })),
  };
}
