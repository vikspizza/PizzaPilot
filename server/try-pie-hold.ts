import { TRY_PIE_HOLD_SECONDS, type TryPieHold } from "@shared/schema";
import type { IStorage } from "./storage";

export type CreateTryPieHoldResult =
  | { ok: true; holdId: string; expiresAt: string; expiresInSeconds: number }
  | { ok: false; status: number; error: string };

export function isTryPieHoldActive(hold: TryPieHold | undefined): hold is TryPieHold {
  if (!hold) {
    return false;
  }

  const expiresMs =
    hold.expiresAt instanceof Date
      ? hold.expiresAt.getTime()
      : new Date(hold.expiresAt).getTime();
  return expiresMs > Date.now();
}

export async function createTryPieHold(
  storage: IStorage,
  batchId: string,
  pizzaId: string,
  date: string,
  slotId: string,
): Promise<CreateTryPieHoldResult> {
  await storage.deleteExpiredTryPieHolds();

  if (!batchId || !pizzaId || !date?.trim() || !slotId?.trim()) {
    return { ok: false, status: 400, error: "batchId, pizzaId, date, and slotId are required" };
  }

  const batch = await storage.getBatchById(batchId);
  if (!batch) {
    return { ok: false, status: 404, error: "Batch not found" };
  }
  if (batch.serviceDate !== date) {
    return { ok: false, status: 400, error: "Order date does not match batch service date." };
  }

  const orderBookedSlotIds = await storage.getBookedSlotIds(batchId, date);
  if (orderBookedSlotIds.includes(slotId)) {
    return {
      ok: false,
      status: 409,
      error: "That pickup time was just taken. Please choose another slot.",
    };
  }

  const heldSlotIds = await storage.getHeldSlotIds(batchId, date);
  if (heldSlotIds.includes(slotId)) {
    return {
      ok: false,
      status: 409,
      error: "That pickup time was just taken. Please choose another slot.",
    };
  }

  const available = await storage.getAvailableQuantity(batchId, pizzaId);
  if (available < 1) {
    return {
      ok: false,
      status: 409,
      error: "Sorry, this pie just sold out. Please try again later.",
    };
  }

  const expiresAt = new Date(Date.now() + TRY_PIE_HOLD_SECONDS * 1000);
  const hold = await storage.createTryPieHold({
    batchId,
    pizzaId,
    serviceDate: date,
    slotId,
    expiresAt,
  });

  return {
    ok: true,
    holdId: hold.id,
    expiresAt: hold.expiresAt.toISOString(),
    expiresInSeconds: TRY_PIE_HOLD_SECONDS,
  };
}

export async function releaseTryPieHold(storage: IStorage, holdId: string): Promise<void> {
  await storage.deleteTryPieHold(holdId);
}

export async function validateTryPieHoldForOrder(
  storage: IStorage,
  holdId: string,
  batchId: string,
  pizzaId: string,
  date: string,
  slotId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const hold = await storage.getTryPieHoldById(holdId);
  if (!isTryPieHoldActive(hold)) {
    return {
      ok: false,
      status: 400,
      error: "Your reservation timed out. Please select a pickup time again.",
    };
  }

  if (
    hold.batchId !== batchId ||
    hold.pizzaId !== pizzaId ||
    hold.serviceDate !== date ||
    hold.slotId !== slotId
  ) {
    return {
      ok: false,
      status: 400,
      error: "Your reservation is no longer valid. Please select a pickup time again.",
    };
  }

  return { ok: true };
}
