CREATE TABLE IF NOT EXISTS "try_pie_invites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"batch_id" varchar NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "try_pie_invites_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "try_pie_invites" ADD CONSTRAINT "try_pie_invites_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_try_pie_invites_batch_id" ON "try_pie_invites"("batch_id");
