import { PACIFIC_TZ } from "@shared/pickup-time";
import type { TryPieInvite } from "@shared/schema";
import type { IStorage } from "./storage";
import { normalizeInviteCode } from "./try-pie-invite-storage";

export type InviteValidationResult =
  | { ok: true; invite: TryPieInvite }
  | { ok: false; status: number; error: string };

function todayPacificDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: PACIFIC_TZ }).format(new Date());
}

export async function validateUnusedTryPieInvite(
  storage: IStorage,
  code: string,
  batchId: string,
): Promise<InviteValidationResult> {
  const normalized = normalizeInviteCode(code);
  if (normalized.length < 4) {
    return { ok: false, status: 400, error: "Enter a valid invite code." };
  }

  const invite = await storage.getTryPieInviteByCode(normalized);
  if (!invite) {
    return { ok: false, status: 404, error: "That invite code is not valid." };
  }

  if (invite.batchId !== batchId) {
    return {
      ok: false,
      status: 400,
      error: "That invite code is not for this batch.",
    };
  }

  if (invite.usedAt) {
    return {
      ok: false,
      status: 410,
      error: "That invite code has already been used.",
    };
  }

  const batch = await storage.getBatchById(batchId);
  if (!batch) {
    return { ok: false, status: 404, error: "Batch not found" };
  }

  const today = todayPacificDateString();
  if (batch.serviceDate < today) {
    return {
      ok: false,
      status: 410,
      error: "That invite code has expired with the batch service date.",
    };
  }

  return { ok: true, invite };
}

export async function createTryPieInviteForBatch(
  storage: IStorage,
  batchId: string,
): Promise<{ ok: true; invite: TryPieInvite } | { ok: false; status: number; error: string }> {
  const batch = await storage.getBatchById(batchId);
  if (!batch) {
    return { ok: false, status: 404, error: "Batch not found" };
  }

  // Retry a few times on rare unique collisions
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const invite = await storage.createTryPieInvite(batchId);
      return { ok: true, invite };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/unique|duplicate/i.test(message) || attempt === 4) {
        throw error;
      }
    }
  }

  return { ok: false, status: 500, error: "Failed to create invite code" };
}
