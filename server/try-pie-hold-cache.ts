export const TRY_PIE_HOLD_SECONDS = 60;

export type SlotHold = {
  id: string;
  batchId: string;
  pizzaId: string;
  serviceDate: string;
  slotId: string;
  expiresAt: number;
};

const holdsById = new Map<string, SlotHold>();

function purgeExpiredHolds(): void {
  const now = Date.now();
  for (const [id, hold] of Array.from(holdsById.entries())) {
    if (hold.expiresAt <= now) {
      holdsById.delete(id);
    }
  }
}

export function isSlotHoldActive(hold: SlotHold | undefined): hold is SlotHold {
  return Boolean(hold && hold.expiresAt > Date.now());
}

export function createSlotHold(input: {
  batchId: string;
  pizzaId: string;
  serviceDate: string;
  slotId: string;
}): SlotHold {
  purgeExpiredHolds();

  const hold: SlotHold = {
    id: crypto.randomUUID(),
    batchId: input.batchId,
    pizzaId: input.pizzaId,
    serviceDate: input.serviceDate,
    slotId: input.slotId,
    expiresAt: Date.now() + TRY_PIE_HOLD_SECONDS * 1000,
  };

  holdsById.set(hold.id, hold);
  return hold;
}

export function getSlotHoldById(id: string): SlotHold | undefined {
  purgeExpiredHolds();
  return holdsById.get(id);
}

export function releaseSlotHold(id: string): void {
  holdsById.delete(id);
}

export function getHeldSlotIds(
  batchId: string,
  serviceDate: string,
  excludeHoldId?: string,
): string[] {
  purgeExpiredHolds();

  const slotIds = new Set<string>();
  for (const hold of Array.from(holdsById.values())) {
    if (hold.id === excludeHoldId) {
      continue;
    }
    if (hold.batchId === batchId && hold.serviceDate === serviceDate) {
      slotIds.add(hold.slotId);
    }
  }

  return Array.from(slotIds);
}

export function isSlotHeld(
  batchId: string,
  serviceDate: string,
  slotId: string,
  excludeHoldId?: string,
): boolean {
  purgeExpiredHolds();

  for (const hold of Array.from(holdsById.values())) {
    if (hold.id === excludeHoldId) {
      continue;
    }
    if (
      hold.batchId === batchId &&
      hold.serviceDate === serviceDate &&
      hold.slotId === slotId
    ) {
      return true;
    }
  }

  return false;
}
