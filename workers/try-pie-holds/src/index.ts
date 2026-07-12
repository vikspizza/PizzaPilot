/**
 * Try a Pie slot-hold coordinator.
 * One Durable Object instance serializes all hold create/release/list ops.
 */
export interface Env {
  TRY_PIE_HOLDS: DurableObjectNamespace;
}

export type SlotHold = {
  id: string;
  batchId: string;
  pizzaId: string;
  serviceDate: string;
  slotId: string;
  expiresAt: number;
};

const TRY_PIE_HOLD_SECONDS = 60;

type CreateBody = {
  batchId: string;
  pizzaId: string;
  serviceDate: string;
  slotId: string;
};

export class TryPieHoldCoordinator implements DurableObject {
  private holds = new Map<string, SlotHold>();

  constructor(
    private readonly state: DurableObjectState,
    _env: Env,
  ) {
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<SlotHold[]>("holds");
      if (stored) {
        for (const hold of stored) {
          this.holds.set(hold.id, hold);
        }
      }
      this.purgeExpired();
    });
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const [id, hold] of this.holds) {
      if (hold.expiresAt <= now) {
        this.holds.delete(id);
      }
    }
  }

  private async persist(): Promise<void> {
    await this.state.storage.put("holds", Array.from(this.holds.values()));
  }

  private isSlotHeld(
    batchId: string,
    serviceDate: string,
    slotId: string,
    excludeHoldId?: string,
  ): boolean {
    for (const hold of this.holds.values()) {
      if (hold.id === excludeHoldId) continue;
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

  async fetch(request: Request): Promise<Response> {
    this.purgeExpired();

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (request.method === "POST" && path === "/create") {
        const body = (await request.json()) as CreateBody;
        if (!body.batchId || !body.pizzaId || !body.serviceDate || !body.slotId) {
          return Response.json({ error: "missing fields" }, { status: 400 });
        }

        if (this.isSlotHeld(body.batchId, body.serviceDate, body.slotId)) {
          return Response.json({ error: "slot_held" }, { status: 409 });
        }

        const hold: SlotHold = {
          id: crypto.randomUUID(),
          batchId: body.batchId,
          pizzaId: body.pizzaId,
          serviceDate: body.serviceDate,
          slotId: body.slotId,
          expiresAt: Date.now() + TRY_PIE_HOLD_SECONDS * 1000,
        };
        this.holds.set(hold.id, hold);
        await this.persist();
        return Response.json(hold, { status: 201 });
      }

      if (request.method === "DELETE" && path.startsWith("/holds/")) {
        const holdId = decodeURIComponent(path.slice("/holds/".length));
        this.holds.delete(holdId);
        await this.persist();
        return new Response(null, { status: 204 });
      }

      if (request.method === "GET" && path.startsWith("/holds/")) {
        const holdId = decodeURIComponent(path.slice("/holds/".length));
        const hold = this.holds.get(holdId);
        if (!hold || hold.expiresAt <= Date.now()) {
          return Response.json({ error: "not_found" }, { status: 404 });
        }
        return Response.json(hold);
      }

      if (request.method === "GET" && path === "/held-slots") {
        const batchId = url.searchParams.get("batchId") ?? "";
        const serviceDate = url.searchParams.get("serviceDate") ?? "";
        const excludeHoldId = url.searchParams.get("excludeHoldId") ?? undefined;
        if (!batchId || !serviceDate) {
          return Response.json({ error: "batchId and serviceDate required" }, { status: 400 });
        }

        const slotIds = new Set<string>();
        for (const hold of this.holds.values()) {
          if (excludeHoldId && hold.id === excludeHoldId) continue;
          if (hold.batchId === batchId && hold.serviceDate === serviceDate) {
            slotIds.add(hold.slotId);
          }
        }
        return Response.json({ slotIds: Array.from(slotIds) });
      }

      return Response.json({ error: "not_found" }, { status: 404 });
    } catch (error) {
      console.error("TryPieHoldCoordinator error:", error);
      return Response.json({ error: "internal_error" }, { status: 500 });
    }
  }
}

/** Stub fetch so the Worker can be deployed (Pages talks to the DO via binding). */
export default {
  async fetch(): Promise<Response> {
    return new Response("Try a Pie hold coordinator worker", { status: 200 });
  },
};
