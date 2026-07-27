-- PizzaPilot Database Schema
-- Run this SQL file directly on your Neon database to create all tables
-- Compatible with PostgreSQL (Neon uses PostgreSQL)

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tables (order matters due to foreign key dependencies)

-- Users table
CREATE TABLE IF NOT EXISTS "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"email" text,
	"avatar_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Customers table
CREATE TABLE IF NOT EXISTS "customers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"avatar_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Pizzas table
CREATE TABLE IF NOT EXISTS "pizzas" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"image_url" text,
	"active" boolean DEFAULT true NOT NULL,
	"sold_out" boolean DEFAULT false NOT NULL,
	"price" numeric(10, 2) NOT NULL
);

-- Batches table (must be created before orders and batch_pizzas due to foreign keys)
CREATE TABLE IF NOT EXISTS "batches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_number" integer NOT NULL UNIQUE,
	"service_date" text NOT NULL,
	"slot_list_id" varchar,
	"service_start_hour" integer DEFAULT 16 NOT NULL,
	"service_end_hour" integer DEFAULT 20 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Orders table
CREATE TABLE IF NOT EXISTS "orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar NOT NULL,
	"batch_id" varchar,
	"pizza_id" varchar NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"type" text NOT NULL,
	"date" text NOT NULL,
	"slot_id" varchar NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Review questions (configurable questionnaire)
CREATE TABLE IF NOT EXISTS "review_questions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL UNIQUE,
	"prompt" text NOT NULL,
	"help_text" text,
	"answer_type" text NOT NULL,
	"options" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Review answers (one row per question per order)
CREATE TABLE IF NOT EXISTS "review_answers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar NOT NULL,
	"question_id" varchar NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "review_answers_order_question_unique" UNIQUE("order_id","question_id")
);

-- Settings table (singleton)
CREATE TABLE IF NOT EXISTS "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"max_pies_per_day" integer DEFAULT 15 NOT NULL,
	"service_days" integer[] DEFAULT ARRAY[4, 5, 6]::integer[] NOT NULL,
	"service_start_hour" integer DEFAULT 16 NOT NULL,
	"service_end_hour" integer DEFAULT 20 NOT NULL
);

-- OTP verification codes (temporary storage)
CREATE TABLE IF NOT EXISTS "otp_codes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Batch Pizzas junction table (pizzas available in each batch with max quantities)
CREATE TABLE IF NOT EXISTS "batch_pizzas" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" varchar NOT NULL,
	"pizza_id" varchar NOT NULL,
	"max_quantity" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints
ALTER TABLE "batch_pizzas" ADD CONSTRAINT "batch_pizzas_batch_id_batches_id_fk" 
	FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "batch_pizzas" ADD CONSTRAINT "batch_pizzas_pizza_id_pizzas_id_fk" 
	FOREIGN KEY ("pizza_id") REFERENCES "pizzas"("id") ON DELETE no action ON UPDATE no action;


ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" 
	FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "orders" ADD CONSTRAINT "orders_batch_id_batches_id_fk" 
	FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "orders" ADD CONSTRAINT "orders_pizza_id_pizzas_id_fk" 
	FOREIGN KEY ("pizza_id") REFERENCES "pizzas"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "review_answers" ADD CONSTRAINT "review_answers_order_id_orders_id_fk"
	FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "review_answers" ADD CONSTRAINT "review_answers_question_id_review_questions_id_fk"
	FOREIGN KEY ("question_id") REFERENCES "review_questions"("id") ON DELETE no action ON UPDATE no action;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_orders_customer_id" ON "orders"("customer_id");
CREATE INDEX IF NOT EXISTS "idx_orders_batch_id" ON "orders"("batch_id");
CREATE INDEX IF NOT EXISTS "idx_orders_pizza_id" ON "orders"("pizza_id");
CREATE INDEX IF NOT EXISTS "idx_orders_date" ON "orders"("date");
CREATE INDEX IF NOT EXISTS "idx_orders_slot_id" ON "orders"("slot_id");
CREATE INDEX IF NOT EXISTS "idx_orders_status" ON "orders"("status");
CREATE INDEX IF NOT EXISTS "idx_review_answers_order_id" ON "review_answers"("order_id");
CREATE INDEX IF NOT EXISTS "idx_review_answers_question_id" ON "review_answers"("question_id");
CREATE INDEX IF NOT EXISTS "idx_batch_pizzas_batch_id" ON "batch_pizzas"("batch_id");
CREATE INDEX IF NOT EXISTS "idx_batch_pizzas_pizza_id" ON "batch_pizzas"("pizza_id");
CREATE INDEX IF NOT EXISTS "idx_otp_codes_phone" ON "otp_codes"("phone");
CREATE INDEX IF NOT EXISTS "idx_otp_codes_expires_at" ON "otp_codes"("expires_at");
CREATE INDEX IF NOT EXISTS "idx_customers_phone" ON "customers"("phone");

-- Pickup slot lists (e.g. a weekend service window) and their bookable time slots
CREATE TABLE IF NOT EXISTS "slot_lists" (
	"slot_list_id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slot_list_name" text NOT NULL,
	"active_yorn" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pickup_slots" (
	"slot_id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slot_list_id" varchar NOT NULL,
	"pickup_time" time NOT NULL, -- Pacific wall-clock time (no date)
	"created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "pickup_slots" ADD CONSTRAINT "pickup_slots_slot_list_id_slot_lists_slot_list_id_fk"
	FOREIGN KEY ("slot_list_id") REFERENCES "slot_lists"("slot_list_id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "batches" ADD CONSTRAINT "batches_slot_list_id_slot_lists_slot_list_id_fk"
	FOREIGN KEY ("slot_list_id") REFERENCES "slot_lists"("slot_list_id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "orders" ADD CONSTRAINT "orders_slot_id_pickup_slots_slot_id_fk"
	FOREIGN KEY ("slot_id") REFERENCES "pickup_slots"("slot_id") ON DELETE no action ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "idx_batches_slot_list_id" ON "batches"("slot_list_id");

-- One-time Try a Pie invite codes (sold-out bypass, batch-scoped)
CREATE TABLE IF NOT EXISTS "try_pie_invites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"batch_id" varchar NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "try_pie_invites_code_unique" UNIQUE("code")
);

ALTER TABLE "try_pie_invites" ADD CONSTRAINT "try_pie_invites_batch_id_batches_id_fk"
	FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "idx_try_pie_invites_batch_id" ON "try_pie_invites"("batch_id");
CREATE INDEX IF NOT EXISTS "idx_pickup_slots_slot_list_id" ON "pickup_slots"("slot_list_id");
CREATE INDEX IF NOT EXISTS "idx_pickup_slots_pickup_time" ON "pickup_slots"("pickup_time");
CREATE INDEX IF NOT EXISTS "idx_slot_lists_active_yorn" ON "slot_lists"("active_yorn");

-- Default review questionnaire
INSERT INTO "review_questions" ("key", "prompt", "help_text", "answer_type", "options", "sort_order", "required", "active")
VALUES
	('star_rating', 'How would you rate this pizza?', 'Tap a star from 1 (poor) to 5 (excellent)', 'stars', NULL, 0, true, true),
	('overall_rating', 'What did you think of this recipe overall?', NULL, 'choice', '["Needs improvement","Good","Awesome","Mind-blowing!"]', 1, true, true),
	('crust_flavor', 'How was the crust flavor?', 'Flavor, depth, fermentation, savoriness', 'choice', '["Underdeveloped / bland","Good flavor","Very flavorful","Exceptional — delicious on its own"]', 2, true, true),
	('crust_quality', 'How was the crust quality & texture?', 'Choose the closest match', 'choice', '["Too dense / underbaked","Too chewy","Good structure but could be lighter","Light, airy, and delicious","Perfect — crisp outside, airy inside"]', 3, true, true),
	('toppings_balance', 'How well did the toppings work together?', NULL, 'choice', '["Not well / flavors clashed","Mostly good but something felt off","Well-balanced and tasty","Fantastic — perfectly harmonious"]', 4, true, true),
	('would_order_again', 'Would you order this pizza again?', NULL, 'choice', '["No","Maybe","Yes","Definitely — put it on the permanent menu!"]', 5, true, true),
	('fair_price', 'In your opinion, what is a fair price for this pizza?', 'What would you comfortably pay for it?', 'choice', '["$15–$17","$18–$20","$21–$23","$24–$26","Other"]', 6, true, true),
	('additional_thoughts', 'Any additional thoughts, suggestions, or flavor notes?', 'Please share anything that would help us improve this recipe.', 'text', NULL, 7, false, true)
ON CONFLICT ("key") DO NOTHING;
