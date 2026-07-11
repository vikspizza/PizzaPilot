import { and, eq, gt, lt, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import type { InsertTryPieHold, TryPieHold } from "@shared/schema";

type AppDatabase =
  | NeonHttpDatabase<typeof schema>
  | NodePgDatabase<typeof schema>
  | NodePgDatabase<Record<string, unknown>>;

export async function deleteExpiredTryPieHolds(db: AppDatabase): Promise<void> {
  await db.delete(schema.tryPieHolds).where(lt(schema.tryPieHolds.expiresAt, sql`now()`));
}

export async function countActiveTryPieHolds(
  db: AppDatabase,
  batchId: string,
  pizzaId: string,
): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.tryPieHolds)
    .where(
      and(
        eq(schema.tryPieHolds.batchId, batchId),
        eq(schema.tryPieHolds.pizzaId, pizzaId),
        gt(schema.tryPieHolds.expiresAt, sql`now()`),
      ),
    );

  return Number(row?.count ?? 0);
}

export async function insertTryPieHold(
  db: AppDatabase,
  hold: InsertTryPieHold,
): Promise<TryPieHold> {
  const [created] = await db.insert(schema.tryPieHolds).values(hold).returning();
  return created;
}

export async function selectTryPieHoldById(
  db: AppDatabase,
  id: string,
): Promise<TryPieHold | undefined> {
  const [hold] = await db
    .select()
    .from(schema.tryPieHolds)
    .where(eq(schema.tryPieHolds.id, id));
  return hold;
}

export async function deleteTryPieHoldById(db: AppDatabase, id: string): Promise<void> {
  await db.delete(schema.tryPieHolds).where(eq(schema.tryPieHolds.id, id));
}
