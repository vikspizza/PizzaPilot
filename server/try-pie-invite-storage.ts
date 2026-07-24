import { and, desc, eq, isNull } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import type { TryPieInvite } from "@shared/schema";

type AppDatabase =
  | NeonHttpDatabase<typeof schema>
  | NodePgDatabase<typeof schema>
  | NodePgDatabase<Record<string, unknown>>;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateInviteCode(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return code;
}

export function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function insertTryPieInvite(
  db: AppDatabase,
  batchId: string,
  code: string,
): Promise<TryPieInvite> {
  const [created] = await db
    .insert(schema.tryPieInvites)
    .values({ batchId, code: normalizeInviteCode(code) })
    .returning();
  return created;
}

export async function selectTryPieInvitesByBatchId(
  db: AppDatabase,
  batchId: string,
): Promise<TryPieInvite[]> {
  return db
    .select()
    .from(schema.tryPieInvites)
    .where(eq(schema.tryPieInvites.batchId, batchId))
    .orderBy(desc(schema.tryPieInvites.createdAt));
}

export async function selectTryPieInviteByCode(
  db: AppDatabase,
  code: string,
): Promise<TryPieInvite | undefined> {
  const [invite] = await db
    .select()
    .from(schema.tryPieInvites)
    .where(eq(schema.tryPieInvites.code, normalizeInviteCode(code)));
  return invite;
}

/** Atomically claim an unused invite for a batch. Returns undefined if invalid/used. */
export async function claimTryPieInvite(
  db: AppDatabase,
  code: string,
  batchId: string,
): Promise<TryPieInvite | undefined> {
  const [updated] = await db
    .update(schema.tryPieInvites)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(schema.tryPieInvites.code, normalizeInviteCode(code)),
        eq(schema.tryPieInvites.batchId, batchId),
        isNull(schema.tryPieInvites.usedAt),
      ),
    )
    .returning();
  return updated;
}

export async function unclaimTryPieInvite(
  db: AppDatabase,
  code: string,
): Promise<void> {
  await db
    .update(schema.tryPieInvites)
    .set({ usedAt: null })
    .where(eq(schema.tryPieInvites.code, normalizeInviteCode(code)));
}
