import type { SlotHold } from "./try-pie-hold-cache";
import {
  TRY_PIE_HOLD_SECONDS,
  createSlotHold as createMemoryHold,
  getHeldSlotIds as getMemoryHeldSlotIds,
  getSlotHoldById as getMemoryHoldById,
  isSlotHeld as isMemorySlotHeld,
  releaseSlotHold as releaseMemoryHold,
} from "./try-pie-hold-cache";

/** Minimal Durable Object types so this module works in Node and Workers. */
export type DurableObjectStubLike = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

export type DurableObjectNamespaceLike = {
  idFromName(name: string): unknown;
  get(id: unknown): DurableObjectStubLike;
};

export type HoldStore = {
  create(input: {
    batchId: string;
    pizzaId: string;
    serviceDate: string;
    slotId: string;
  }): Promise<{ ok: true; hold: SlotHold } | { ok: false; conflict: true }>;
  release(holdId: string): Promise<void>;
  get(holdId: string): Promise<SlotHold | undefined>;
  getHeldSlotIds(
    batchId: string,
    serviceDate: string,
    excludeHoldId?: string,
  ): Promise<string[]>;
  isSlotHeld(
    batchId: string,
    serviceDate: string,
    slotId: string,
    excludeHoldId?: string,
  ): Promise<boolean>;
};

const memoryHoldStore: HoldStore = {
  async create(input) {
    if (isMemorySlotHeld(input.batchId, input.serviceDate, input.slotId)) {
      return { ok: false, conflict: true };
    }
    return { ok: true, hold: createMemoryHold(input) };
  },
  async release(holdId) {
    releaseMemoryHold(holdId);
  },
  async get(holdId) {
    return getMemoryHoldById(holdId);
  },
  async getHeldSlotIds(batchId, serviceDate, excludeHoldId) {
    return getMemoryHeldSlotIds(batchId, serviceDate, excludeHoldId);
  },
  async isSlotHeld(batchId, serviceDate, slotId, excludeHoldId) {
    return isMemorySlotHeld(batchId, serviceDate, slotId, excludeHoldId);
  },
};

const COORDINATOR_NAME = "global";

function getCoordinatorStub(ns: DurableObjectNamespaceLike): DurableObjectStubLike {
  return ns.get(ns.idFromName(COORDINATOR_NAME));
}

export function createDurableHoldStore(ns: DurableObjectNamespaceLike): HoldStore {
  return {
    async create(input) {
      const stub = getCoordinatorStub(ns);
      const res = await stub.fetch("https://hold/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (res.status === 409) {
        return { ok: false, conflict: true };
      }
      if (!res.ok) {
        throw new Error(`Durable hold create failed: ${res.status}`);
      }
      const hold = (await res.json()) as SlotHold;
      return { ok: true, hold };
    },

    async release(holdId) {
      const stub = getCoordinatorStub(ns);
      await stub.fetch(`https://hold/holds/${encodeURIComponent(holdId)}`, {
        method: "DELETE",
      });
    },

    async get(holdId) {
      const stub = getCoordinatorStub(ns);
      const res = await stub.fetch(`https://hold/holds/${encodeURIComponent(holdId)}`);
      if (res.status === 404) {
        return undefined;
      }
      if (!res.ok) {
        throw new Error(`Durable hold get failed: ${res.status}`);
      }
      return (await res.json()) as SlotHold;
    },

    async getHeldSlotIds(batchId, serviceDate, excludeHoldId) {
      const stub = getCoordinatorStub(ns);
      const params = new URLSearchParams({ batchId, serviceDate });
      if (excludeHoldId) {
        params.set("excludeHoldId", excludeHoldId);
      }
      const res = await stub.fetch(`https://hold/held-slots?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Durable held-slots failed: ${res.status}`);
      }
      const data = (await res.json()) as { slotIds: string[] };
      return data.slotIds;
    },

    async isSlotHeld(batchId, serviceDate, slotId, excludeHoldId) {
      const held = await this.getHeldSlotIds(batchId, serviceDate, excludeHoldId);
      return held.includes(slotId);
    },
  };
}

export function resolveHoldStore(ns?: DurableObjectNamespaceLike): HoldStore {
  if (ns) {
    return createDurableHoldStore(ns);
  }
  return memoryHoldStore;
}

export { TRY_PIE_HOLD_SECONDS, memoryHoldStore };
