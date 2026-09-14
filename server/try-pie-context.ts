import { comparePickupTime } from "@shared/pickup-time";
import { getPriorityWindowEndsAt } from "@shared/signup-throttle";
import type { Batch, PickupSlot } from "@shared/schema";
import { getHeldSlotIds } from "./try-pie-hold";
import type { HoldStore } from "./try-pie-hold-store";
import type { IStorage } from "./storage";

export type TryPieBatchPizza = {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  available: number;
};

export type TryPieContext = {
  batch: {
    id: string;
    serviceDate: string;
    batchNumber: number;
    activatedAt: string | null;
    priorityWindowEndsAt: string | null;
  } | null;
  pizzas: TryPieBatchPizza[];
} & (
  | { available: false; soldOut?: boolean; notActivated?: boolean }
  | {
      available: true;
      pizzaId: string;
      pizzaName: string;
      date: string;
      slots: PickupSlot[];
      bookedSlotIds: string[];
    }
);

function batchSummary(batch: Batch) {
  const endsAt = getPriorityWindowEndsAt(batch.activatedAt);
  return {
    id: batch.id,
    serviceDate: batch.serviceDate,
    batchNumber: batch.batchNumber,
    activatedAt: batch.activatedAt ? new Date(batch.activatedAt).toISOString() : null,
    priorityWindowEndsAt: endsAt ? endsAt.toISOString() : null,
  };
}

async function getUpcomingBatch(storage: IStorage): Promise<Batch | undefined> {
  const today = new Date().toISOString().split("T")[0];
  const allBatches = await storage.getBatches();
  const candidates = allBatches
    .filter((b) => Boolean(b.activatedAt) && b.serviceDate >= today)
    .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate));

  return candidates[0];
}

function mapBatchPizzas(
  batchPizzas: Awaited<ReturnType<IStorage["getBatchPizzas"]>>,
): TryPieBatchPizza[] {
  return batchPizzas.map((entry) => ({
    id: entry.pizzaId,
    name: entry.pizza.name,
    description: entry.pizza.description,
    imageUrl: entry.pizza.imageUrl ?? null,
    available: entry.available,
  }));
}

async function buildAvailableContext(
  storage: IStorage,
  batch: Batch,
  batchPizzas: Awaited<ReturnType<IStorage["getBatchPizzas"]>>,
  options: { bypassSoldOut?: boolean; holdStore?: HoldStore } = {},
): Promise<TryPieContext> {
  const pizzas = mapBatchPizzas(batchPizzas);
  const summary = batchSummary(batch);

  if (!batch.activatedAt) {
    return { batch: summary, pizzas, available: false, notActivated: true };
  }

  if (batchPizzas.length === 0) {
    return { batch: summary, pizzas, available: false };
  }

  if (!batch.slotListId) {
    return { batch: summary, pizzas, available: false };
  }

  const anyAvailable = batchPizzas.some((entry) => entry.available > 0);
  if (!anyAvailable && !options.bypassSoldOut) {
    return { batch: summary, pizzas, available: false, soldOut: true };
  }

  const selected =
    batchPizzas.find((entry) => entry.available > 0) ?? batchPizzas[0];
  const slots = (await storage.getPickupSlots(batch.slotListId)).sort((a, b) =>
    comparePickupTime(a.pickupTime, b.pickupTime),
  );
  const orderBookedSlotIds = await storage.getBookedSlotIds(batch.id, batch.serviceDate);
  let heldSlotIds: string[] = [];
  try {
    heldSlotIds = await getHeldSlotIds(batch.id, batch.serviceDate, options.holdStore);
  } catch (error) {
    console.warn("Failed to load held slots; continuing without holds:", error);
  }
  const bookedSlotIds = Array.from(new Set([...orderBookedSlotIds, ...heldSlotIds]));

  return {
    batch: summary,
    pizzas,
    available: true,
    pizzaId: selected.pizzaId,
    pizzaName: selected.pizza.name,
    date: batch.serviceDate,
    slots,
    bookedSlotIds,
  };
}

export async function getTryPieContext(
  storage: IStorage,
  holdStore?: HoldStore,
): Promise<TryPieContext> {
  const batch = await getUpcomingBatch(storage);

  if (!batch) {
    return { batch: null, pizzas: [], available: false };
  }

  const batchPizzas = await storage.getBatchPizzas(batch.id);
  return buildAvailableContext(storage, batch, batchPizzas, { holdStore });
}

/** Full ordering context for a batch, ignoring sold-out pie counts (invite redeem). */
export async function getTryPieContextForBatch(
  storage: IStorage,
  batchId: string,
  holdStore?: HoldStore,
): Promise<TryPieContext | null> {
  const batch = await storage.getBatchById(batchId);
  if (!batch) {
    return null;
  }

  const batchPizzas = await storage.getBatchPizzas(batch.id);
  return buildAvailableContext(storage, batch, batchPizzas, {
    bypassSoldOut: true,
    holdStore,
  });
}
