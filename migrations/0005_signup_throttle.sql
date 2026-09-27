CREATE TABLE IF NOT EXISTS "signup_throttle" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" varchar NOT NULL,
	"phone" text NOT NULL,
	"stage" text NOT NULL,
	"retry_after_seconds" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "signup_throttle_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_signup_throttle_batch_id" ON "signup_throttle"("batch_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_signup_throttle_phone" ON "signup_throttle"("phone");
