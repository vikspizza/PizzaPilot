import {
  TRY_PIE_HOLD_SECONDS,
  createSlotHold,
  getHeldSlotIds,
  getSlotHoldById,
  isSlotHeld,
  isSlotHoldActive,
  releaseSlotHold,
} from "./try-pie-hold-cache";
import type { IStorage } from "./storage";

export type CreateTryPieHoldResult =
  | { ok: true; holdId: string; expiresAt: string; expiresInSeconds: number }
  | { ok: false; status: number; error: string };

export async function createTryPieHold(
  storage: IStorage,
  batchId: string,
  pizzaId: string,
  date: string,
  slotId: string,
): Promise<CreateTryPieHoldResult> {
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

  if (isSlotHeld(batchId, date, slotId)) {
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

  const hold = createSlotHold({
    batchId,
    pizzaId,
    serviceDate: date,
    slotId,
  });

  return {
    ok: true,
    holdId: hold.id,
    expiresAt: new Date(hold.expiresAt).toISOString(),
    expiresInSeconds: TRY_PIE_HOLD_SECONDS,
  };
}

export function releaseTryPieHold(holdId: string): void {
  releaseSlotHold(holdId);
}

export function validateTryPieHoldForOrder(
  holdId: string,
  batchId: string,
  pizzaId: string,
  date: string,
  slotId: string,
): { ok: true } | { ok: false; status: number; error: string } {
  const hold = getSlotHoldById(holdId);
  if (!isSlotHoldActive(hold)) {
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

export { getHeldSlotIds };
