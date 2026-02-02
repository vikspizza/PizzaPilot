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
	"service_start_hour" integer DEFAULT 16 NOT NULL,
	"service_end_hour" integer DEFAULT 20 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Orders table
CREATE TABLE IF NOT EXISTS "orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"batch_id" varchar,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_phone" text NOT NULL,
	"pizza_id" varchar NOT NULL,
	"quantity" integer NOT NULL,
	"type" text NOT NULL,
	"date" text NOT NULL,
	"time_slot" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Reviews table
CREATE TABLE IF NOT EXISTS "reviews" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar NOT NULL,
	"pizza_id" varchar NOT NULL,
	"rating" integer NOT NULL,
	"comment" text NOT NULL,
	"author" text NOT NULL,
	"overall_rating" text,
	"fair_price" text,
	"custom_price_amount" text,
	"crust_flavor" text,
	"crust_quality" text,
	"toppings_balance" text,
	"would_order_again" text,
	"created_at" timestamp DEFAULT now() NOT NULL
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

ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" 
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "orders" ADD CONSTRAINT "orders_batch_id_batches_id_fk" 
	FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "orders" ADD CONSTRAINT "orders_pizza_id_pizzas_id_fk" 
	FOREIGN KEY ("pizza_id") REFERENCES "pizzas"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fk" 
	FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_pizza_id_pizzas_id_fk" 
	FOREIGN KEY ("pizza_id") REFERENCES "pizzas"("id") ON DELETE no action ON UPDATE no action;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_orders_user_id" ON "orders"("user_id");
CREATE INDEX IF NOT EXISTS "idx_orders_batch_id" ON "orders"("batch_id");
CREATE INDEX IF NOT EXISTS "idx_orders_pizza_id" ON "orders"("pizza_id");
CREATE INDEX IF NOT EXISTS "idx_orders_date" ON "orders"("date");
CREATE INDEX IF NOT EXISTS "idx_orders_status" ON "orders"("status");
CREATE INDEX IF NOT EXISTS "idx_reviews_order_id" ON "reviews"("order_id");
CREATE INDEX IF NOT EXISTS "idx_reviews_pizza_id" ON "reviews"("pizza_id");
CREATE INDEX IF NOT EXISTS "idx_batch_pizzas_batch_id" ON "batch_pizzas"("batch_id");
CREATE INDEX IF NOT EXISTS "idx_batch_pizzas_pizza_id" ON "batch_pizzas"("pizza_id");
CREATE INDEX IF NOT EXISTS "idx_otp_codes_phone" ON "otp_codes"("phone");
CREATE INDEX IF NOT EXISTS "idx_otp_codes_expires_at" ON "otp_codes"("expires_at");
