// Cloudflare-specific storage (uses db-cf instead of db)
// This avoids importing db.ts which has pg (Node.js) dependencies
import { eq, and, sql, desc, asc, notInArray } from "drizzle-orm";
import * as schema from "@shared/schema";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type {
  User,
  InsertUser,
  Pizza,
  InsertPizza,
  Order,
  InsertOrder,
  OrderWithCustomer,
  Customer,
  InsertCustomer,
  Review,
  ReviewQuestion,
  SubmitReviewRequest,
  Settings,
  InsertSettings,
  OtpCode,
  InsertOtpCode,
  Batch,
  InsertBatch,
  BatchPizza,
  InsertBatchPizza,
  SlotList,
  InsertSlotList,
  PickupSlot,
  InsertPickupSlot,
  TryPieInvite,
} from "@shared/schema";
import {
  getCustomerById as fetchCustomerById,
  getCustomerByPhone as fetchCustomerByPhone,
  selectOrderWithCustomerById,
  selectOrdersWithCustomer,
  selectOrdersWithCustomerByDate,
  selectOrdersWithCustomerByCustomerPhone,
  getBookedSlotIds as fetchBookedSlotIds,
  hasExistingBatchOrder as fetchHasExistingBatchOrder,
  upsertCustomer as upsertCustomerRecord,
} from "./order-storage";
import {
  claimTryPieInvite as claimTryPieInviteRecord,
  generateInviteCode,
  insertTryPieInvite,
  selectTryPieInviteByCode,
  selectTryPieInvitesByBatchId,
  unclaimTryPieInvite as unclaimTryPieInviteRecord,
} from "./try-pie-invite-storage";
import {
  insertReviewAnswers,
  selectActiveReviewQuestions,
  selectReviewByOrderId,
  selectReviewedOrderIds,
  selectReviews,
  selectReviewsByPizzaId,
} from "./review-storage";

// Re-implement DatabaseStorage using Cloudflare-compatible db
// This is identical to storage.ts but uses db-cf instead of db
// db is passed in constructor since we can't use process.env in Workers
class DatabaseStorage {
  constructor(private db: ReturnType<typeof import("./db-cf").getDb>) {}
  // Users
  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(schema.users).where(eq(schema.users.phone, phone));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await this.db.insert(schema.users).values(user).returning();
    return newUser;
  }

  async updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await this.db
      .update(schema.users)
      .set(user)
      .where(eq(schema.users.id, id))
      .returning();
    return updated;
  }

  // Customers
  async getCustomerById(id: string): Promise<Customer | undefined> {
    return fetchCustomerById(this.db, id);
  }

  async getCustomerByPhone(phone: string): Promise<Customer | undefined> {
    return fetchCustomerByPhone(this.db, phone);
  }

  async upsertCustomer(customer: InsertCustomer): Promise<Customer> {
    return upsertCustomerRecord(this.db, customer);
  }

  // OTP
  async createOtpCode(otp: InsertOtpCode): Promise<OtpCode> {
    const [code] = await this.db.insert(schema.otpCodes).values(otp).returning();
    return code;
  }

  async getValidOtpCode(phone: string, code: string): Promise<OtpCode | undefined> {
    const [otpCode] = await this.db
      .select()
      .from(schema.otpCodes)
      .where(
        and(
          eq(schema.otpCodes.phone, phone),
          eq(schema.otpCodes.code, code),
          sql`${schema.otpCodes.expiresAt} > NOW()`
        )
      );
    return otpCode;
  }

  async deleteOtpCode(id: string): Promise<void> {
    await this.db.delete(schema.otpCodes).where(eq(schema.otpCodes.id, id));
  }

  // Pizzas
  async getPizzas(): Promise<Pizza[]> {
    return this.db.select().from(schema.pizzas);
  }

  async getActivePizzas(): Promise<Pizza[]> {
    return this.db.select().from(schema.pizzas).where(eq(schema.pizzas.active, true));
  }

  async getPizzaById(id: string): Promise<Pizza | undefined> {
    const [pizza] = await this.db.select().from(schema.pizzas).where(eq(schema.pizzas.id, id));
    return pizza;
  }

  async createPizza(pizza: InsertPizza): Promise<Pizza> {
    const [newPizza] = await this.db.insert(schema.pizzas).values(pizza).returning();
    return newPizza;
  }

  async updatePizza(id: string, pizza: Partial<InsertPizza>): Promise<Pizza | undefined> {
    const [updated] = await this.db
      .update(schema.pizzas)
      .set(pizza)
      .where(eq(schema.pizzas.id, id))
      .returning();
    return updated;
  }

  // Orders
  async getOrders(): Promise<OrderWithCustomer[]> {
    return selectOrdersWithCustomer(this.db);
  }

  async getOrdersByCustomerPhone(phone: string): Promise<OrderWithCustomer[]> {
    return selectOrdersWithCustomerByCustomerPhone(this.db, phone);
  }

  async getOrderById(id: string): Promise<OrderWithCustomer | undefined> {
    return selectOrderWithCustomerById(this.db, id);
  }

  async getOrdersByDate(date: string): Promise<OrderWithCustomer[]> {
    return selectOrdersWithCustomerByDate(this.db, date);
  }

  async getBookedSlotIds(batchId: string | null | undefined, date: string): Promise<string[]> {
    return fetchBookedSlotIds(this.db, { batchId, date });
  }

  async hasExistingBatchOrder(batchId: string, phone: string, email: string): Promise<boolean> {
    return fetchHasExistingBatchOrder(this.db, batchId, phone, email);
  }

  async createOrder(order: InsertOrder): Promise<OrderWithCustomer> {
    const [newOrder] = await this.db.insert(schema.orders).values(order).returning();
    const created = await selectOrderWithCustomerById(this.db, newOrder.id);
    if (!created) {
      throw new Error("Failed to load order after create");
    }
    return created;
  }

  async updateOrderStatus(id: string, status: string): Promise<OrderWithCustomer | undefined> {
    const [updated] = await this.db
      .update(schema.orders)
      .set({ status })
      .where(eq(schema.orders.id, id))
      .returning();
    if (!updated) {
      return undefined;
    }
    return selectOrderWithCustomerById(this.db, updated.id);
  }

  // Reviews
  async getReviewQuestions(): Promise<ReviewQuestion[]> {
    return selectActiveReviewQuestions(this.db);
  }

  async getReviews(): Promise<Review[]> {
    return selectReviews(this.db);
  }

  async getReviewsByPizzaId(pizzaId: string): Promise<Review[]> {
    return selectReviewsByPizzaId(this.db, pizzaId);
  }

  async getReviewByOrderId(orderId: string): Promise<Review | undefined> {
    return selectReviewByOrderId(this.db, orderId);
  }

  async getPendingReviewsByCustomerPhone(phone: string): Promise<OrderWithCustomer[]> {
    const orders = await this.getOrdersByCustomerPhone(phone);
    const reviewedOrderIds = await selectReviewedOrderIds(this.db);

    return orders.filter(
      (order) =>
        (order.status === "delivered" || order.status === "completed") &&
        !reviewedOrderIds.has(order.id),
    );
  }

  async createReview(review: SubmitReviewRequest): Promise<Review> {
    return insertReviewAnswers(this.db, review);
  }

  // Settings
  async getSettings(): Promise<Settings> {
    const [settings] = await this.db.select().from(schema.settings).limit(1);
    if (!settings) {
      // Create default settings if none exist
      const [newSettings] = await this.db
        .insert(schema.settings)
        .values({
          maxPiesPerDay: 15,
          serviceDays: [4, 5, 6], // Thu, Fri, Sat
          serviceStartHour: 16, // 4 PM
          serviceEndHour: 20, // 8 PM
        })
        .returning();
      return newSettings;
    }
    return settings;
  }

  async updateSettings(settingsUpdate: Partial<InsertSettings>): Promise<Settings> {
    const [updated] = await this.db
      .update(schema.settings)
      .set(settingsUpdate)
      .where(eq(schema.settings.id, 1))
      .returning();
    if (!updated) {
      throw new Error("Settings not found");
    }
    return updated;
  }

  // Batches
  async getBatches(): Promise<Batch[]> {
    return this.db.select().from(schema.batches).orderBy(schema.batches.batchNumber);
  }

  async getBatchById(id: string): Promise<Batch | undefined> {
    const [batch] = await this.db.select().from(schema.batches).where(eq(schema.batches.id, id));
    return batch;
  }

  async getBatchByNumber(batchNumber: number): Promise<Batch | undefined> {
    const [batch] = await this.db
      .select()
      .from(schema.batches)
      .where(eq(schema.batches.batchNumber, batchNumber));
    return batch;
  }

  async getBatchByDate(date: string): Promise<Batch | undefined> {
    const [batch] = await this.db
      .select()
      .from(schema.batches)
      .where(eq(schema.batches.serviceDate, date));
    return batch;
  }

  async createBatch(batch: InsertBatch): Promise<Batch> {
    const [newBatch] = await this.db.insert(schema.batches).values(batch).returning();
    return newBatch;
  }

  async updateBatch(id: string, batch: Partial<InsertBatch>): Promise<Batch | undefined> {
    const [updated] = await this.db
      .update(schema.batches)
      .set(batch)
      .where(eq(schema.batches.id, id))
      .returning();
    return updated;
  }

  async deleteBatch(id: string): Promise<void> {
    await this.db.delete(schema.batches).where(eq(schema.batches.id, id));
  }

  // Batch Pizzas
  async getBatchPizzas(batchId: string): Promise<(BatchPizza & { pizza: Pizza; available: number })[]> {
    const results = await this.db
      .select({
        id: schema.batchPizzas.id,
        batchId: schema.batchPizzas.batchId,
        pizzaId: schema.batchPizzas.pizzaId,
        maxQuantity: schema.batchPizzas.maxQuantity,
        createdAt: schema.batchPizzas.createdAt,
        pizza: {
          id: schema.pizzas.id,
          name: schema.pizzas.name,
          description: schema.pizzas.description,
          tags: schema.pizzas.tags,
          imageUrl: schema.pizzas.imageUrl,
          active: schema.pizzas.active,
          soldOut: schema.pizzas.soldOut,
          price: schema.pizzas.price,
        },
      })
      .from(schema.batchPizzas)
      .innerJoin(schema.pizzas, eq(schema.batchPizzas.pizzaId, schema.pizzas.id))
      .where(eq(schema.batchPizzas.batchId, batchId));

    return Promise.all(
      results.map(async (r) => ({
        id: r.id,
        batchId: r.batchId,
        pizzaId: r.pizzaId,
        maxQuantity: r.maxQuantity,
        createdAt: r.createdAt,
        pizza: r.pizza,
        available: await this.getAvailableQuantity(batchId, r.pizzaId),
      })),
    );
  }

  async getBatchPizza(batchId: string, pizzaId: string): Promise<BatchPizza | undefined> {
    const [batchPizza] = await this.db
      .select()
      .from(schema.batchPizzas)
      .where(
        and(
          eq(schema.batchPizzas.batchId, batchId),
          eq(schema.batchPizzas.pizzaId, pizzaId)
        )
      );
    return batchPizza;
  }

  async createBatchPizza(batchPizza: InsertBatchPizza): Promise<BatchPizza> {
    const [newBatchPizza] = await this.db.insert(schema.batchPizzas).values(batchPizza).returning();
    return newBatchPizza;
  }

  async updateBatchPizza(id: string, batchPizza: Partial<InsertBatchPizza>): Promise<BatchPizza | undefined> {
    const [updated] = await this.db
      .update(schema.batchPizzas)
      .set(batchPizza)
      .where(eq(schema.batchPizzas.id, id))
      .returning();
    return updated;
  }

  async deleteBatchPizza(id: string): Promise<void> {
    await this.db.delete(schema.batchPizzas).where(eq(schema.batchPizzas.id, id));
  }

  async deleteBatchPizzasByBatchId(batchId: string): Promise<void> {
    await this.db.delete(schema.batchPizzas).where(eq(schema.batchPizzas.batchId, batchId));
  }

  // Batch availability
  async getAvailableQuantity(batchId: string, pizzaId: string): Promise<number> {
    const batchPizza = await this.getBatchPizza(batchId, pizzaId);
    if (!batchPizza) return 0;

    const [result] = await this.db
      .select({
        total: sql<number>`coalesce(sum(${schema.orders.quantity}), 0)::int`,
      })
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.batchId, batchId),
          eq(schema.orders.pizzaId, pizzaId),
          notInArray(schema.orders.status, ["cancelled"]),
        ),
      );

    const orderedQuantity = Number(result?.total ?? 0);
    return Math.max(0, batchPizza.maxQuantity - orderedQuantity);
  }

  async isPizzaAvailableInBatch(batchId: string, pizzaId: string, quantity: number): Promise<boolean> {
    const available = await this.getAvailableQuantity(batchId, pizzaId);
    return available >= quantity;
  }

  async getPastExperiments(): Promise<Array<Pizza & { offerCount: number }>> {
    const rows = await this.db
      .select({
        pizza: schema.pizzas,
        pizzaId: schema.batchPizzas.pizzaId,
      })
      .from(schema.batchPizzas)
      .innerJoin(schema.pizzas, eq(schema.batchPizzas.pizzaId, schema.pizzas.id));

    const byPizzaId = new Map<string, { pizza: Pizza; count: number }>();
    for (const row of rows) {
      if (byPizzaId.has(row.pizzaId)) {
        byPizzaId.get(row.pizzaId)!.count++;
      } else {
        byPizzaId.set(row.pizzaId, { pizza: row.pizza, count: 1 });
      }
    }
    return Array.from(byPizzaId.values())
      .map(({ pizza, count }) => ({ ...pizza, offerCount: count }))
      .sort((a, b) => b.offerCount - a.offerCount);
  }

  // Slot lists
  async getSlotLists(): Promise<SlotList[]> {
    return this.db
      .select()
      .from(schema.slotLists)
      .orderBy(desc(schema.slotLists.createdAt));
  }

  async getSlotListById(id: string): Promise<SlotList | undefined> {
    const [slotList] = await this.db
      .select()
      .from(schema.slotLists)
      .where(eq(schema.slotLists.slotListId, id));
    return slotList;
  }

  async createSlotList(slotList: InsertSlotList): Promise<SlotList> {
    if (slotList.activeYorn) {
      await this.db.update(schema.slotLists).set({ activeYorn: false });
    }
    const [created] = await this.db.insert(schema.slotLists).values(slotList).returning();
    return created;
  }

  async updateSlotList(id: string, slotList: Partial<InsertSlotList>): Promise<SlotList | undefined> {
    if (slotList.activeYorn) {
      await this.db.update(schema.slotLists).set({ activeYorn: false });
    }
    const [updated] = await this.db
      .update(schema.slotLists)
      .set(slotList)
      .where(eq(schema.slotLists.slotListId, id))
      .returning();
    return updated;
  }

  async deleteSlotList(id: string): Promise<void> {
    await this.db.delete(schema.slotLists).where(eq(schema.slotLists.slotListId, id));
  }

  // Pickup slots
  async getActivePickupSlots(): Promise<PickupSlot[]> {
    const [activeList] = await this.db
      .select()
      .from(schema.slotLists)
      .where(eq(schema.slotLists.activeYorn, true))
      .limit(1);
    if (!activeList) {
      return [];
    }
    return this.getPickupSlots(activeList.slotListId);
  }

  async getPickupSlots(slotListId: string): Promise<PickupSlot[]> {
    return this.db
      .select()
      .from(schema.pickupSlots)
      .where(eq(schema.pickupSlots.slotListId, slotListId))
      .orderBy(asc(schema.pickupSlots.pickupTime));
  }

  async createPickupSlot(pickupSlot: InsertPickupSlot): Promise<PickupSlot> {
    const [created] = await this.db.insert(schema.pickupSlots).values(pickupSlot).returning();
    return created;
  }

  async deletePickupSlot(slotId: string): Promise<void> {
    await this.db.delete(schema.pickupSlots).where(eq(schema.pickupSlots.slotId, slotId));
  }

  async createTryPieInvite(batchId: string, code?: string): Promise<TryPieInvite> {
    return insertTryPieInvite(this.db, batchId, code ?? generateInviteCode());
  }

  async getTryPieInvitesByBatchId(batchId: string): Promise<TryPieInvite[]> {
    return selectTryPieInvitesByBatchId(this.db, batchId);
  }

  async getTryPieInviteByCode(code: string): Promise<TryPieInvite | undefined> {
    return selectTryPieInviteByCode(this.db, code);
  }

  async claimTryPieInvite(code: string, batchId: string): Promise<TryPieInvite | undefined> {
    return claimTryPieInviteRecord(this.db, code, batchId);
  }

  async unclaimTryPieInvite(code: string): Promise<void> {
    await unclaimTryPieInviteRecord(this.db, code);
  }
}

// Export class instead of instance (instance created in function handler with db)
export { DatabaseStorage };
