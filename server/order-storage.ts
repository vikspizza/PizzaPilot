import { and, eq, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import type { Customer, InsertCustomer, Order, OrderWithCustomer, PickupSlot } from "@shared/schema";

type AppDatabase =
  | NeonHttpDatabase<typeof schema>
  | NodePgDatabase<typeof schema>
  | NodePgDatabase<Record<string, unknown>>;

export function mapOrderWithCustomer(
  order: Order,
  customer: Customer,
  pickupSlot: PickupSlot,
): OrderWithCustomer {
  return { ...order, customer, pickupSlot };
}

function ordersWithCustomerQuery(db: AppDatabase) {
  return db
    .select({ order: schema.orders, customer: schema.customers, pickupSlot: schema.pickupSlots })
    .from(schema.orders)
    .innerJoin(schema.customers, eq(schema.orders.customerId, schema.customers.id))
    .innerJoin(schema.pickupSlots, eq(schema.orders.slotId, schema.pickupSlots.slotId));
}

export async function selectOrdersWithCustomer(db: AppDatabase): Promise<OrderWithCustomer[]> {
  const rows = await ordersWithCustomerQuery(db);
  return rows.map(({ order, customer, pickupSlot }) => mapOrderWithCustomer(order, customer, pickupSlot));
}

export async function selectOrderWithCustomerById(
  db: AppDatabase,
  id: string,
): Promise<OrderWithCustomer | undefined> {
  const [row] = await ordersWithCustomerQuery(db).where(eq(schema.orders.id, id));
  return row ? mapOrderWithCustomer(row.order, row.customer, row.pickupSlot) : undefined;
}

export async function getBookedSlotIds(
  db: AppDatabase,
  { batchId, date }: { batchId?: string | null; date: string },
): Promise<string[]> {
  const conditions = [
    eq(schema.orders.date, date),
    sql`${schema.orders.status} != 'cancelled'`,
  ];
  if (batchId) {
    conditions.push(eq(schema.orders.batchId, batchId));
  }

  const rows = await db
    .select({ slotId: schema.orders.slotId })
    .from(schema.orders)
    .where(and(...conditions));

  return [...new Set(rows.map((row) => row.slotId))];
}

export async function selectOrdersWithCustomerByCustomerPhone(
  db: AppDatabase,
  phone: string,
): Promise<OrderWithCustomer[]> {
  const rows = await ordersWithCustomerQuery(db).where(eq(schema.customers.phone, phone));
  return rows.map(({ order, customer, pickupSlot }) => mapOrderWithCustomer(order, customer, pickupSlot));
}

export async function selectOrdersWithCustomerByDate(
  db: AppDatabase,
  date: string,
): Promise<OrderWithCustomer[]> {
  const rows = await ordersWithCustomerQuery(db).where(eq(schema.orders.date, date));
  return rows.map(({ order, customer, pickupSlot }) => mapOrderWithCustomer(order, customer, pickupSlot));
}

export async function getCustomerByPhone(
  db: AppDatabase,
  phone: string,
): Promise<Customer | undefined> {
  const [customer] = await db
    .select()
    .from(schema.customers)
    .where(eq(schema.customers.phone, phone));
  return customer;
}

export async function getCustomerById(
  db: AppDatabase,
  id: string,
): Promise<Customer | undefined> {
  const [customer] = await db
    .select()
    .from(schema.customers)
    .where(eq(schema.customers.id, id));
  return customer;
}

export async function upsertCustomer(
  db: AppDatabase,
  data: InsertCustomer,
): Promise<Customer> {
  const existing = await getCustomerByPhone(db, data.phone);
  if (existing) {
    const [updated] = await db
      .update(schema.customers)
      .set({
        name: data.name,
        email: data.email,
        avatarUrl: data.avatarUrl ?? existing.avatarUrl,
      })
      .where(eq(schema.customers.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db.insert(schema.customers).values(data).returning();
  return created;
}
