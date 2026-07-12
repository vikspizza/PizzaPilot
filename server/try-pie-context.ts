import { comparePickupTime } from "@shared/pickup-time";
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
  } | null;
  pizzas: TryPieBatchPizza[];
} & (
  | { available: false; soldOut?: boolean }
  | {
      available: true;
      pizzaId: string;
      pizzaName: string;
      date: string;
      slots: PickupSlot[];
      bookedSlotIds: string[];
    }
);

async function getUpcomingBatch(storage: IStorage): Promise<Batch | undefined> {
  const today = new Date().toISOString().split("T")[0];
  let batch = await storage.getBatchByDate(today);

  if (!batch) {
    const allBatches = await storage.getBatches();
    batch =
      allBatches
        .filter((b) => b.serviceDate >= today)
        .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate))[0] ?? undefined;
  }

  return batch;
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

export async function getTryPieContext(
  storage: IStorage,
  holdStore?: HoldStore,
): Promise<TryPieContext> {
  const batch = await getUpcomingBatch(storage);

  if (!batch) {
    return { batch: null, pizzas: [], available: false };
  }

  const batchPizzas = await storage.getBatchPizzas(batch.id);
  const pizzas = mapBatchPizzas(batchPizzas);
  const batchSummary = {
    id: batch.id,
    serviceDate: batch.serviceDate,
    batchNumber: batch.batchNumber,
  };

  if (batchPizzas.length === 0) {
    return { batch: batchSummary, pizzas, available: false };
  }

  if (!batch.slotListId) {
    return { batch: batchSummary, pizzas, available: false };
  }

  const anyAvailable = batchPizzas.some((entry) => entry.available > 0);
  if (!anyAvailable) {
    return { batch: batchSummary, pizzas, available: false, soldOut: true };
  }

  const selected = batchPizzas.find((entry) => entry.available > 0) ?? batchPizzas[0];
  const slots = (await storage.getPickupSlots(batch.slotListId)).sort((a, b) =>
    comparePickupTime(a.pickupTime, b.pickupTime),
  );
  const orderBookedSlotIds = await storage.getBookedSlotIds(batch.id, batch.serviceDate);
  const heldSlotIds = await getHeldSlotIds(batch.id, batch.serviceDate, holdStore);
  const bookedSlotIds = Array.from(new Set([...orderBookedSlotIds, ...heldSlotIds]));

  return {
    batch: batchSummary,
    pizzas,
    available: true,
    pizzaId: selected.pizzaId,
    pizzaName: selected.pizza.name,
    date: batch.serviceDate,
    slots,
    bookedSlotIds,
  };
}
