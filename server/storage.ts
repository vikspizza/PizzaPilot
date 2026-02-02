import { eq, and, sql } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@shared/schema";
import type {
  User,
  InsertUser,
  Pizza,
  InsertPizza,
  Order,
  InsertOrder,
  Review,
  InsertReview,
  Settings,
  InsertSettings,
  OtpCode,
  InsertOtpCode,
  Batch,
  InsertBatch,
  BatchPizza,
  InsertBatchPizza,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUserById(id: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;

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
  getOrders(): Promise<Order[]>;
  getOrdersByUserId(userId: string): Promise<Order[]>;
  getOrderById(id: string): Promise<Order | undefined>;
  getOrdersByDate(date: string): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrderStatus(id: string, status: string): Promise<Order | undefined>;

  // Reviews
  getReviews(): Promise<Review[]>;
  getReviewsByPizzaId(pizzaId: string): Promise<Review[]>;
  getReviewByOrderId(orderId: string): Promise<Review | undefined>;
  getPendingReviewsByUserId(userId: string): Promise<Order[]>;
  createReview(review: InsertReview): Promise<Review>;

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
  getBatchPizzas(batchId: string): Promise<(BatchPizza & { pizza: Pizza })[]>;
  getBatchPizza(batchId: string, pizzaId: string): Promise<BatchPizza | undefined>;
  createBatchPizza(batchPizza: InsertBatchPizza): Promise<BatchPizza>;
  updateBatchPizza(id: string, batchPizza: Partial<InsertBatchPizza>): Promise<BatchPizza | undefined>;
  deleteBatchPizza(id: string): Promise<void>;
  deleteBatchPizzasByBatchId(batchId: string): Promise<void>;
  
  // Batch availability
  getAvailableQuantity(batchId: string, pizzaId: string): Promise<number>;
  isPizzaAvailableInBatch(batchId: string, pizzaId: string, quantity: number): Promise<boolean>;
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
  async getOrders(): Promise<Order[]> {
    return db.select().from(schema.orders);
  }

  async getOrdersByUserId(userId: string): Promise<Order[]> {
    return db.select().from(schema.orders).where(eq(schema.orders.userId, userId));
  }

  async getOrderById(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, id));
    return order;
  }

  async getOrdersByDate(date: string): Promise<Order[]> {
    return db.select().from(schema.orders).where(eq(schema.orders.date, date));
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [newOrder] = await db.insert(schema.orders).values({
      ...order,
      status: "confirmed",
    }).returning();
    return newOrder;
  }

  async updateOrderStatus(id: string, status: string): Promise<Order | undefined> {
    const [updated] = await db
      .update(schema.orders)
      .set({ status })
      .where(eq(schema.orders.id, id))
      .returning();
    return updated;
  }

  // Reviews
  async getReviews(): Promise<Review[]> {
    return db.select().from(schema.reviews);
  }

  async getReviewsByPizzaId(pizzaId: string): Promise<Review[]> {
    return db.select().from(schema.reviews).where(eq(schema.reviews.pizzaId, pizzaId));
  }

  async getReviewByOrderId(orderId: string): Promise<Review | undefined> {
    const [review] = await db.select().from(schema.reviews).where(eq(schema.reviews.orderId, orderId));
    return review;
  }

  async getPendingReviewsByUserId(userId: string): Promise<Order[]> {
    // Get all delivered/completed orders for user
    const completedOrders = await db
      .select()
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.userId, userId),
          sql`${schema.orders.status} IN ('delivered', 'completed')`
        )
      );
    
    // Get all reviews for these orders
    const allReviews = await db.select().from(schema.reviews);
    const reviewedOrderIds = new Set(allReviews.map(r => r.orderId));
    
    // Return orders that don't have reviews
    return completedOrders.filter(o => !reviewedOrderIds.has(o.id));
  }

  async createReview(review: InsertReview): Promise<Review> {
    const [newReview] = await db.insert(schema.reviews).values(review).returning();
    return newReview;
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
  async getBatchPizzas(batchId: string): Promise<(BatchPizza & { pizza: Pizza })[]> {
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
    
    return results.map(r => ({
      id: r.id,
      batchId: r.batchId,
      pizzaId: r.pizzaId,
      maxQuantity: r.maxQuantity,
      createdAt: r.createdAt,
      pizza: r.pizza,
    }));
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

    // Get total quantity ordered for this pizza in this batch
    const orders = await db
      .select()
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.batchId, batchId),
          eq(schema.orders.pizzaId, pizzaId),
          sql`${schema.orders.status} NOT IN ('cancelled')`
        )
      );
    
    const orderedQuantity = orders.reduce((sum, order) => sum + order.quantity, 0);
    return Math.max(0, batchPizza.maxQuantity - orderedQuantity);
  }

  async isPizzaAvailableInBatch(batchId: string, pizzaId: string, quantity: number): Promise<boolean> {
    const available = await this.getAvailableQuantity(batchId, pizzaId);
    return available >= quantity;
  }
}

export const storage = new DatabaseStorage();
