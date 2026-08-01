import { eq, and, sql, desc, asc, notInArray } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@shared/schema";
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
  BatchReviewAnalytics,
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
  mapOrderWithCustomer,
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
  selectBatchReviewAnalytics,
  selectReviewByOrderId,
  selectReviewedOrderIds,
  selectReviews,
  selectReviewsByPizzaId,
} from "./review-storage";

export interface IStorage {
  // Users
  getUserById(id: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;

  // Customers
  getCustomerById(id: string): Promise<Customer | undefined>;
  getCustomerByPhone(phone: string): Promise<Customer | undefined>;
  upsertCustomer(customer: InsertCustomer): Promise<Customer>;

  // OTP
  createOtpCode(otp: InsertOtpCode): Promise<OtpCode>;
  getValidOtpCode(phone: string, code: string): Promise<OtpCode | undefined>;
  deleteOtpCode(id: string): Promise<void>;

  // Pizzas
  getPizzas(): Promise<Pizza[]>;
  getActivePizzas(): Promise<Pizza[]>;
  getPizzaById(id: string): Promise<Pizza | undefined>;
  createPizza(pizza: InsertPizza): Promise<Pizza>;
  updatePizza(id: string, pizza: Partial<InsertPizza>): Promise<Pizza | undefined>;

  // Orders
  getOrders(): Promise<OrderWithCustomer[]>;
  getOrdersByCustomerPhone(phone: string): Promise<OrderWithCustomer[]>;
  getOrderById(id: string): Promise<OrderWithCustomer | undefined>;
  getOrdersByDate(date: string): Promise<OrderWithCustomer[]>;
  getBookedSlotIds(batchId: string | null | undefined, date: string): Promise<string[]>;
  hasExistingBatchOrder(batchId: string, phone: string, email: string): Promise<boolean>;
  createOrder(order: InsertOrder): Promise<OrderWithCustomer>;
  updateOrderStatus(id: string, status: string): Promise<OrderWithCustomer | undefined>;

  // Reviews
  getReviewQuestions(): Promise<ReviewQuestion[]>;
  getReviews(): Promise<Review[]>;
  getReviewsByPizzaId(pizzaId: string): Promise<Review[]>;
  getReviewByOrderId(orderId: string): Promise<Review | undefined>;
  getBatchReviewAnalytics(batchId: string): Promise<BatchReviewAnalytics | undefined>;
  getPendingReviewsByCustomerPhone(phone: string): Promise<OrderWithCustomer[]>;
  createReview(review: SubmitReviewRequest): Promise<Review>;

  // Settings
  getSettings(): Promise<Settings>;
  updateSettings(settings: Partial<InsertSettings>): Promise<Settings>;

  // Batches
  getBatches(): Promise<Batch[]>;
  getBatchById(id: string): Promise<Batch | undefined>;
  getBatchByNumber(batchNumber: number): Promise<Batch | undefined>;
  getBatchByDate(date: string): Promise<Batch | undefined>;
  createBatch(batch: InsertBatch): Promise<Batch>;
  updateBatch(id: string, batch: Partial<InsertBatch>): Promise<Batch | undefined>;
  deleteBatch(id: string): Promise<void>;

  // Batch Pizzas
  getBatchPizzas(batchId: string): Promise<(BatchPizza & { pizza: Pizza; available: number })[]>;
  getBatchPizza(batchId: string, pizzaId: string): Promise<BatchPizza | undefined>;
  createBatchPizza(batchPizza: InsertBatchPizza): Promise<BatchPizza>;
  updateBatchPizza(id: string, batchPizza: Partial<InsertBatchPizza>): Promise<BatchPizza | undefined>;
  deleteBatchPizza(id: string): Promise<void>;
  deleteBatchPizzasByBatchId(batchId: string): Promise<void>;
  
  // Batch availability
  getAvailableQuantity(batchId: string, pizzaId: string): Promise<number>;
  isPizzaAvailableInBatch(batchId: string, pizzaId: string, quantity: number): Promise<boolean>;

  // Slot lists
  getSlotLists(): Promise<SlotList[]>;
  getSlotListById(id: string): Promise<SlotList | undefined>;
  createSlotList(slotList: InsertSlotList): Promise<SlotList>;
  updateSlotList(id: string, slotList: Partial<InsertSlotList>): Promise<SlotList | undefined>;
  deleteSlotList(id: string): Promise<void>;

  // Pickup slots
  getActivePickupSlots(): Promise<PickupSlot[]>;
  getPickupSlots(slotListId: string): Promise<PickupSlot[]>;
  createPickupSlot(pickupSlot: InsertPickupSlot): Promise<PickupSlot>;
  deletePickupSlot(slotId: string): Promise<void>;

  // Past experiments: distinct pizzas ever offered, with count of batches each appeared in
  getPastExperiments(): Promise<Array<Pizza & { offerCount: number }>>;

  // Try a Pie invite codes
  createTryPieInvite(batchId: string, code?: string): Promise<TryPieInvite>;
  getTryPieInvitesByBatchId(batchId: string): Promise<TryPieInvite[]>;
  getTryPieInviteByCode(code: string): Promise<TryPieInvite | undefined>;
  claimTryPieInvite(code: string, batchId: string): Promise<TryPieInvite | undefined>;
  unclaimTryPieInvite(code: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.phone, phone));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(schema.users).values(user).returning();
    return newUser;
  }

  async updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db
      .update(schema.users)
      .set(user)
      .where(eq(schema.users.id, id))
      .returning();
    return updated;
  }

  // Customers
  async getCustomerById(id: string): Promise<Customer | undefined> {
    return fetchCustomerById(db, id);
  }

  async getCustomerByPhone(phone: string): Promise<Customer | undefined> {
    return fetchCustomerByPhone(db, phone);
  }

  async upsertCustomer(customer: InsertCustomer): Promise<Customer> {
    return upsertCustomerRecord(db, customer);
  }

  // OTP
  async createOtpCode(otp: InsertOtpCode): Promise<OtpCode> {
    const [code] = await db.insert(schema.otpCodes).values(otp).returning();
    return code;
  }

  async getValidOtpCode(phone: string, code: string): Promise<OtpCode | undefined> {
    const [otpCode] = await db
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
    await db.delete(schema.otpCodes).where(eq(schema.otpCodes.id, id));
  }

  // Pizzas
  async getPizzas(): Promise<Pizza[]> {
    return db.select().from(schema.pizzas);
  }

  async getActivePizzas(): Promise<Pizza[]> {
    return db.select().from(schema.pizzas).where(eq(schema.pizzas.active, true));
  }

  async getPizzaById(id: string): Promise<Pizza | undefined> {
    const [pizza] = await db.select().from(schema.pizzas).where(eq(schema.pizzas.id, id));
    return pizza;
  }

  async createPizza(pizza: InsertPizza): Promise<Pizza> {
    const [newPizza] = await db.insert(schema.pizzas).values(pizza).returning();
    return newPizza;
  }

  async updatePizza(id: string, pizza: Partial<InsertPizza>): Promise<Pizza | undefined> {
    const [updated] = await db
      .update(schema.pizzas)
      .set(pizza)
      .where(eq(schema.pizzas.id, id))
      .returning();
    return updated;
  }

  // Orders
  async getOrders(): Promise<OrderWithCustomer[]> {
    return selectOrdersWithCustomer(db);
  }

  async getOrdersByCustomerPhone(phone: string): Promise<OrderWithCustomer[]> {
    return selectOrdersWithCustomerByCustomerPhone(db, phone);
  }

  async getOrderById(id: string): Promise<OrderWithCustomer | undefined> {
    return selectOrderWithCustomerById(db, id);
  }

  async getOrdersByDate(date: string): Promise<OrderWithCustomer[]> {
    return selectOrdersWithCustomerByDate(db, date);
  }

  async getBookedSlotIds(batchId: string | null | undefined, date: string): Promise<string[]> {
    return fetchBookedSlotIds(db, { batchId, date });
  }

  async hasExistingBatchOrder(batchId: string, phone: string, email: string): Promise<boolean> {
    return fetchHasExistingBatchOrder(db, batchId, phone, email);
  }

  async createOrder(order: InsertOrder): Promise<OrderWithCustomer> {
    const [newOrder] = await db.insert(schema.orders).values({
      ...order,
      status: "confirmed",
    }).returning();
    const created = await selectOrderWithCustomerById(db, newOrder.id);
    if (!created) {
      throw new Error("Failed to load order after create");
    }
    return created;
  }

  async updateOrderStatus(id: string, status: string): Promise<OrderWithCustomer | undefined> {
    const [updated] = await db
      .update(schema.orders)
      .set({ status })
      .where(eq(schema.orders.id, id))
      .returning();
    if (!updated) {
      return undefined;
    }
    return selectOrderWithCustomerById(db, updated.id);
  }

  // Reviews
  async getReviewQuestions(): Promise<ReviewQuestion[]> {
    return selectActiveReviewQuestions(db);
  }

  async getReviews(): Promise<Review[]> {
    return selectReviews(db);
  }

  async getReviewsByPizzaId(pizzaId: string): Promise<Review[]> {
    return selectReviewsByPizzaId(db, pizzaId);
  }

  async getReviewByOrderId(orderId: string): Promise<Review | undefined> {
    return selectReviewByOrderId(db, orderId);
  }

  async getBatchReviewAnalytics(batchId: string): Promise<BatchReviewAnalytics | undefined> {
    return selectBatchReviewAnalytics(db, batchId);
  }

  async getPendingReviewsByCustomerPhone(phone: string): Promise<OrderWithCustomer[]> {
    const completedOrders = await db
      .select({ order: schema.orders, customer: schema.customers, pickupSlot: schema.pickupSlots })
      .from(schema.orders)
      .innerJoin(schema.customers, eq(schema.orders.customerId, schema.customers.id))
      .innerJoin(schema.pickupSlots, eq(schema.orders.slotId, schema.pickupSlots.slotId))
      .where(
        and(
          eq(schema.customers.phone, phone),
          sql`${schema.orders.status} IN ('delivered', 'completed')`
        )
      );

    const reviewedOrderIds = await selectReviewedOrderIds(db);

    return completedOrders
      .map(({ order, customer, pickupSlot }) => mapOrderWithCustomer(order, customer, pickupSlot))
      .filter((order) => !reviewedOrderIds.has(order.id));
  }

  async createReview(review: SubmitReviewRequest): Promise<Review> {
    return insertReviewAnswers(db, review);
  }

  // Settings
  async getSettings(): Promise<Settings> {
    const [settings] = await db.select().from(schema.settings);
    if (!settings) {
      // Create default settings if they don't exist
      const [newSettings] = await db
        .insert(schema.settings)
        .values({
          maxPiesPerDay: 15,
          serviceDays: [4, 5, 6],
          serviceStartHour: 16,
          serviceEndHour: 20,
        })
        .returning();
      return newSettings;
    }
    return settings;
  }

  async updateSettings(settings: Partial<InsertSettings>): Promise<Settings> {
    const [updated] = await db
      .update(schema.settings)
      .set(settings)
      .where(eq(schema.settings.id, 1))
      .returning();
    return updated;
  }

  // Batches
  async getBatches(): Promise<Batch[]> {
    return db.select().from(schema.batches).orderBy(schema.batches.batchNumber);
  }

  async getBatchById(id: string): Promise<Batch | undefined> {
    const [batch] = await db.select().from(schema.batches).where(eq(schema.batches.id, id));
    return batch;
  }

  async getBatchByNumber(batchNumber: number): Promise<Batch | undefined> {
    const [batch] = await db
      .select()
      .from(schema.batches)
      .where(eq(schema.batches.batchNumber, batchNumber));
    return batch;
  }

  async getBatchByDate(date: string): Promise<Batch | undefined> {
    const [batch] = await db
      .select()
      .from(schema.batches)
      .where(eq(schema.batches.serviceDate, date));
    return batch;
  }

  async createBatch(batch: InsertBatch): Promise<Batch> {
    const [newBatch] = await db.insert(schema.batches).values(batch).returning();
    return newBatch;
  }

  async updateBatch(id: string, batch: Partial<InsertBatch>): Promise<Batch | undefined> {
    const [updated] = await db
      .update(schema.batches)
      .set(batch)
      .where(eq(schema.batches.id, id))
      .returning();
    return updated;
  }

  async deleteBatch(id: string): Promise<void> {
    await db.delete(schema.batches).where(eq(schema.batches.id, id));
  }

  // Batch Pizzas
  async getBatchPizzas(batchId: string): Promise<(BatchPizza & { pizza: Pizza; available: number })[]> {
    const results = await db
      .select({
        id: schema.batchPizzas.id,
        batchId: schema.batchPizzas.batchId,
        pizzaId: schema.batchPizzas.pizzaId,
        maxQuantity: schema.batchPizzas.maxQuantity,
        createdAt: schema.batchPizzas.createdAt,
        pizza: schema.pizzas,
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
    const [batchPizza] = await db
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
    const [newBatchPizza] = await db.insert(schema.batchPizzas).values(batchPizza).returning();
    return newBatchPizza;
  }

  async updateBatchPizza(id: string, batchPizza: Partial<InsertBatchPizza>): Promise<BatchPizza | undefined> {
    const [updated] = await db
      .update(schema.batchPizzas)
      .set(batchPizza)
      .where(eq(schema.batchPizzas.id, id))
      .returning();
    return updated;
  }

  async deleteBatchPizza(id: string): Promise<void> {
    await db.delete(schema.batchPizzas).where(eq(schema.batchPizzas.id, id));
  }

  async deleteBatchPizzasByBatchId(batchId: string): Promise<void> {
    await db.delete(schema.batchPizzas).where(eq(schema.batchPizzas.batchId, batchId));
  }

  // Batch availability
  async getAvailableQuantity(batchId: string, pizzaId: string): Promise<number> {
    const batchPizza = await this.getBatchPizza(batchId, pizzaId);
    if (!batchPizza) return 0;

    const [result] = await db
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
    const rows = await db
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
    return db
      .select()
      .from(schema.slotLists)
      .orderBy(desc(schema.slotLists.createdAt));
  }

  async getSlotListById(id: string): Promise<SlotList | undefined> {
    const [slotList] = await db
      .select()
      .from(schema.slotLists)
      .where(eq(schema.slotLists.slotListId, id));
    return slotList;
  }

  async createSlotList(slotList: InsertSlotList): Promise<SlotList> {
    if (slotList.activeYorn) {
      await db.update(schema.slotLists).set({ activeYorn: false });
    }
    const [created] = await db.insert(schema.slotLists).values(slotList).returning();
    return created;
  }

  async updateSlotList(id: string, slotList: Partial<InsertSlotList>): Promise<SlotList | undefined> {
    if (slotList.activeYorn) {
      await db.update(schema.slotLists).set({ activeYorn: false });
    }
    const [updated] = await db
      .update(schema.slotLists)
      .set(slotList)
      .where(eq(schema.slotLists.slotListId, id))
      .returning();
    return updated;
  }

  async deleteSlotList(id: string): Promise<void> {
    await db.delete(schema.slotLists).where(eq(schema.slotLists.slotListId, id));
  }

  // Pickup slots
  async getActivePickupSlots(): Promise<PickupSlot[]> {
    const [activeList] = await db
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
    return db
      .select()
      .from(schema.pickupSlots)
      .where(eq(schema.pickupSlots.slotListId, slotListId))
      .orderBy(asc(schema.pickupSlots.pickupTime));
  }

  async createPickupSlot(pickupSlot: InsertPickupSlot): Promise<PickupSlot> {
    const [created] = await db.insert(schema.pickupSlots).values(pickupSlot).returning();
    return created;
  }

  async deletePickupSlot(slotId: string): Promise<void> {
    await db.delete(schema.pickupSlots).where(eq(schema.pickupSlots.slotId, slotId));
  }

  async createTryPieInvite(batchId: string, code?: string): Promise<TryPieInvite> {
    return insertTryPieInvite(db, batchId, code ?? generateInviteCode());
  }

  async getTryPieInvitesByBatchId(batchId: string): Promise<TryPieInvite[]> {
    return selectTryPieInvitesByBatchId(db, batchId);
  }

  async getTryPieInviteByCode(code: string): Promise<TryPieInvite | undefined> {
    return selectTryPieInviteByCode(db, code);
  }

  async claimTryPieInvite(code: string, batchId: string): Promise<TryPieInvite | undefined> {
    return claimTryPieInviteRecord(db, code, batchId);
  }

  async unclaimTryPieInvite(code: string): Promise<void> {
    await unclaimTryPieInviteRecord(db, code);
  }
}

export const storage = new DatabaseStorage();
