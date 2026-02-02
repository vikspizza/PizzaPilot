import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phone: text("phone").notNull().unique(),
  name: text("name").notNull(),
  email: text("email"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Pizzas table
export const pizzas = pgTable("pizzas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
  imageUrl: text("image_url"),
  active: boolean("active").notNull().default(true),
  soldOut: boolean("sold_out").notNull().default(false),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
});

export const insertPizzaSchema = createInsertSchema(pizzas).omit({
  id: true,
});

export type InsertPizza = z.infer<typeof insertPizzaSchema>;
export type Pizza = typeof pizzas.$inferSelect;

// Orders table
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  batchId: varchar("batch_id").references(() => batches.id), // Link order to batch
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone").notNull(),
  pizzaId: varchar("pizza_id").references(() => pizzas.id).notNull(),
  quantity: integer("quantity").notNull(),
  type: text("type").notNull(), // "pickup" | "delivery"
  date: text("date").notNull(), // ISO Date string (YYYY-MM-DD)
  timeSlot: text("time_slot").notNull(), // e.g., "16:00", "16:30"
  status: text("status").notNull().default("pending"), // "pending" | "confirmed" | "cooking" | "ready" | "delivered" | "completed" | "cancelled"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  status: true,
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// Reviews table
export const reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => orders.id).notNull(),
  pizzaId: varchar("pizza_id").references(() => pizzas.id).notNull(),
  rating: integer("rating").notNull(), // Keep for backward compatibility
  comment: text("comment").notNull(), // Keep for backward compatibility, now stores additionalThoughts
  author: text("author").notNull(),
  // New questionnaire fields stored as JSON
  overallRating: text("overall_rating"), // "Needs improvement" | "Good" | "Awesome" | "Mind-blowing!"
  fairPrice: text("fair_price"), // "$15–$17" | "$18–$20" | "$21–$23" | "$24–$26" | "Other"
  customPriceAmount: text("custom_price_amount"), // If fairPrice is "Other"
  crustFlavor: text("crust_flavor"), // "Underdeveloped / bland" | "Good flavor" | "Very flavorful" | "Exceptional — delicious on its own"
  crustQuality: text("crust_quality"), // "Too dense / underbaked" | "Too chewy" | "Good structure but could be lighter" | "Light, airy, and delicious" | "Perfect — crisp outside, airy inside"
  toppingsBalance: text("toppings_balance"), // "Not well / flavors clashed" | "Mostly good but something felt off" | "Well-balanced and tasty" | "Fantastic — perfectly harmonious"
  wouldOrderAgain: text("would_order_again"), // "No" | "Maybe" | "Yes" | "Definitely — put it on the permanent menu!"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true,
}).extend({
  overallRating: z.string().optional(),
  fairPrice: z.string().optional(),
  customPriceAmount: z.string().optional(),
  crustFlavor: z.string().optional(),
  crustQuality: z.string().optional(),
  toppingsBalance: z.string().optional(),
  wouldOrderAgain: z.string().optional(),
});

export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviews.$inferSelect;

// Settings table (singleton)
export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  maxPiesPerDay: integer("max_pies_per_day").notNull().default(15),
  serviceDays: integer("service_days").array().notNull().default(sql`ARRAY[4, 5, 6]::integer[]`), // 0=Sun, 1=Mon, ..., 4=Thu, 5=Fri, 6=Sat
  serviceStartHour: integer("service_start_hour").notNull().default(16), // 16 = 4PM
  serviceEndHour: integer("service_end_hour").notNull().default(20), // 20 = 8PM
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
});

export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;

// OTP verification codes (temporary storage)
export const otpCodes = pgTable("otp_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phone: text("phone").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOtpCodeSchema = createInsertSchema(otpCodes).omit({
  id: true,
  createdAt: true,
});

export type InsertOtpCode = z.infer<typeof insertOtpCodeSchema>;
export type OtpCode = typeof otpCodes.$inferSelect;

// Batches table
export const batches = pgTable("batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchNumber: integer("batch_number").notNull().unique(),
  serviceDate: text("service_date").notNull(), // ISO Date string (YYYY-MM-DD)
  serviceStartHour: integer("service_start_hour").notNull().default(16), // 16 = 4PM
  serviceEndHour: integer("service_end_hour").notNull().default(20), // 20 = 8PM
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBatchSchema = createInsertSchema(batches).omit({
  id: true,
  createdAt: true,
});

export type InsertBatch = z.infer<typeof insertBatchSchema>;
export type Batch = typeof batches.$inferSelect;

// Batch Pizzas junction table (pizzas available in each batch with max quantities)
export const batchPizzas = pgTable("batch_pizzas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchId: varchar("batch_id").references(() => batches.id).notNull(),
  pizzaId: varchar("pizza_id").references(() => pizzas.id).notNull(),
  maxQuantity: integer("max_quantity").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBatchPizzaSchema = createInsertSchema(batchPizzas).omit({
  id: true,
  createdAt: true,
});

export type InsertBatchPizza = z.infer<typeof insertBatchPizzaSchema>;
export type BatchPizza = typeof batchPizzas.$inferSelect;
