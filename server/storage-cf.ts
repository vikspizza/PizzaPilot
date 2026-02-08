// Cloudflare-specific storage (uses db-cf instead of db)
// This avoids importing db.ts which has pg (Node.js) dependencies
import { eq, and, sql } from "drizzle-orm";
import * as schema from "@shared/schema";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
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
  async getOrders(): Promise<Order[]> {
    return this.db.select().from(schema.orders).orderBy(schema.orders.createdAt);
  }

  async getOrdersByUserId(userId: string): Promise<Order[]> {
    return this.db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.userId, userId))
      .orderBy(schema.orders.createdAt);
  }

  async getOrderById(id: string): Promise<Order | undefined> {
    const [order] = await this.db.select().from(schema.orders).where(eq(schema.orders.id, id));
    return order;
  }

  async getOrdersByDate(date: string): Promise<Order[]> {
    return this.db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.date, date))
      .orderBy(schema.orders.timeSlot);
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [newOrder] = await this.db.insert(schema.orders).values(order).returning();
    return newOrder;
  }

  async updateOrderStatus(id: string, status: string): Promise<Order | undefined> {
    const [updated] = await this.db
      .update(schema.orders)
      .set({ status })
      .where(eq(schema.orders.id, id))
      .returning();
    return updated;
  }

  // Reviews
  async getReviews(): Promise<Review[]> {
    return this.db.select().from(schema.reviews).orderBy(schema.reviews.createdAt);
  }

  async getReviewsByPizzaId(pizzaId: string): Promise<Review[]> {
    return this.db
      .select()
      .from(schema.reviews)
      .where(eq(schema.reviews.pizzaId, pizzaId))
      .orderBy(schema.reviews.createdAt);
  }

  async getReviewByOrderId(orderId: string): Promise<Review | undefined> {
    const [review] = await this.db
      .select()
      .from(schema.reviews)
      .where(eq(schema.reviews.orderId, orderId));
    return review;
  }

  async getPendingReviewsByUserId(userId: string): Promise<Order[]> {
    // Get orders that are delivered/completed but don't have reviews
    const orders = await this.getOrdersByUserId(userId);
    const reviews = await this.db
      .select()
      .from(schema.reviews);
    
    const reviewedOrderIds = new Set(reviews.map(r => r.orderId));
    return orders.filter(
      order => 
        (order.status === "delivered" || order.status === "completed") &&
        !reviewedOrderIds.has(order.id)
    );
  }

  async createReview(review: InsertReview): Promise<Review> {
    const [newReview] = await this.db.insert(schema.reviews).values(review).returning();
    return newReview;
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
  async getBatchPizzas(batchId: string): Promise<(BatchPizza & { pizza: Pizza })[]> {
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

    return results.map((r) => ({
      id: r.id,
      batchId: r.batchId,
      pizzaId: r.pizzaId,
      maxQuantity: r.maxQuantity,
      createdAt: r.createdAt,
      pizza: r.pizza,
    }));
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

    // Get total quantity ordered for this pizza in this batch
    const orders = await this.db
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
}

// Export class instead of instance (instance created in function handler with db)
export { DatabaseStorage };
