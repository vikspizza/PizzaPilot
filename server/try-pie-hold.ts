import type { IStorage } from "./storage";
import {
  TRY_PIE_HOLD_SECONDS,
  resolveHoldStore,
  type HoldStore,
} from "./try-pie-hold-store";
import { isSlotHoldActive } from "./try-pie-hold-cache";

export type CreateTryPieHoldResult =
  | { ok: true; holdId: string; expiresAt: string; expiresInSeconds: number }
  | { ok: false; status: number; error: string };

function storeOrDefault(holdStore?: HoldStore): HoldStore {
  return holdStore ?? resolveHoldStore();
}

export async function createTryPieHold(
  storage: IStorage,
  batchId: string,
  pizzaId: string,
  date: string,
  slotId: string,
  holdStore?: HoldStore,
): Promise<CreateTryPieHoldResult> {
  const store = storeOrDefault(holdStore);

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

  const available = await storage.getAvailableQuantity(batchId, pizzaId);
  if (available < 1) {
    return {
      ok: false,
      status: 409,
      error: "Sorry, this pie just sold out. Please try again later.",
    };
  }

  const created = await store.create({
    batchId,
    pizzaId,
    serviceDate: date,
    slotId,
  });

  if (!created.ok) {
    return {
      ok: false,
      status: 409,
      error: "That pickup time was just taken. Please choose another slot.",
    };
  }

  return {
    ok: true,
    holdId: created.hold.id,
    expiresAt: new Date(created.hold.expiresAt).toISOString(),
    expiresInSeconds: TRY_PIE_HOLD_SECONDS,
  };
}

export async function releaseTryPieHold(
  holdId: string,
  holdStore?: HoldStore,
): Promise<void> {
  await storeOrDefault(holdStore).release(holdId);
}

export async function validateTryPieHoldForOrder(
  holdId: string,
  batchId: string,
  pizzaId: string,
  date: string,
  slotId: string,
  holdStore?: HoldStore,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const hold = await storeOrDefault(holdStore).get(holdId);
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

export async function getHeldSlotIds(
  batchId: string,
  serviceDate: string,
  holdStore?: HoldStore,
  excludeHoldId?: string,
): Promise<string[]> {
  return storeOrDefault(holdStore).getHeldSlotIds(batchId, serviceDate, excludeHoldId);
}
