CREATE TABLE IF NOT EXISTS "review_questions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"prompt" text NOT NULL,
	"help_text" text,
	"answer_type" text NOT NULL,
	"options" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "review_questions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "review_answers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar NOT NULL,
	"question_id" varchar NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "review_answers_order_question_unique" UNIQUE("order_id","question_id")
);
--> statement-breakpoint
ALTER TABLE "review_answers" ADD CONSTRAINT "review_answers_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "review_answers" ADD CONSTRAINT "review_answers_question_id_review_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."review_questions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_review_answers_order_id" ON "review_answers"("order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_review_answers_question_id" ON "review_answers"("question_id");
--> statement-breakpoint
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
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'reviews'
  ) THEN
    INSERT INTO "review_answers" ("order_id", "question_id", "value", "created_at")
    SELECT r."order_id", q."id", r."rating"::text, r."created_at"
    FROM "reviews" r
    JOIN "review_questions" q ON q."key" = 'star_rating'
    WHERE r."rating" IS NOT NULL
    ON CONFLICT ("order_id", "question_id") DO NOTHING;

    INSERT INTO "review_answers" ("order_id", "question_id", "value", "created_at")
    SELECT r."order_id", q."id", r."overall_rating", r."created_at"
    FROM "reviews" r
    JOIN "review_questions" q ON q."key" = 'overall_rating'
    WHERE r."overall_rating" IS NOT NULL AND btrim(r."overall_rating") <> ''
    ON CONFLICT ("order_id", "question_id") DO NOTHING;

    INSERT INTO "review_answers" ("order_id", "question_id", "value", "created_at")
    SELECT r."order_id", q."id", r."crust_flavor", r."created_at"
    FROM "reviews" r
    JOIN "review_questions" q ON q."key" = 'crust_flavor'
    WHERE r."crust_flavor" IS NOT NULL AND btrim(r."crust_flavor") <> ''
    ON CONFLICT ("order_id", "question_id") DO NOTHING;

    INSERT INTO "review_answers" ("order_id", "question_id", "value", "created_at")
    SELECT r."order_id", q."id", r."crust_quality", r."created_at"
    FROM "reviews" r
    JOIN "review_questions" q ON q."key" = 'crust_quality'
    WHERE r."crust_quality" IS NOT NULL AND btrim(r."crust_quality") <> ''
    ON CONFLICT ("order_id", "question_id") DO NOTHING;

    INSERT INTO "review_answers" ("order_id", "question_id", "value", "created_at")
    SELECT r."order_id", q."id", r."toppings_balance", r."created_at"
    FROM "reviews" r
    JOIN "review_questions" q ON q."key" = 'toppings_balance'
    WHERE r."toppings_balance" IS NOT NULL AND btrim(r."toppings_balance") <> ''
    ON CONFLICT ("order_id", "question_id") DO NOTHING;

    INSERT INTO "review_answers" ("order_id", "question_id", "value", "created_at")
    SELECT r."order_id", q."id", r."would_order_again", r."created_at"
    FROM "reviews" r
    JOIN "review_questions" q ON q."key" = 'would_order_again'
    WHERE r."would_order_again" IS NOT NULL AND btrim(r."would_order_again") <> ''
    ON CONFLICT ("order_id", "question_id") DO NOTHING;

    INSERT INTO "review_answers" ("order_id", "question_id", "value", "created_at")
    SELECT r."order_id", q."id",
      CASE
        WHEN r."fair_price" = 'Other' AND r."custom_price_amount" IS NOT NULL AND btrim(r."custom_price_amount") <> ''
          THEN 'Other: ' || r."custom_price_amount"
        ELSE r."fair_price"
      END,
      r."created_at"
    FROM "reviews" r
    JOIN "review_questions" q ON q."key" = 'fair_price'
    WHERE r."fair_price" IS NOT NULL AND btrim(r."fair_price") <> ''
    ON CONFLICT ("order_id", "question_id") DO NOTHING;

    INSERT INTO "review_answers" ("order_id", "question_id", "value", "created_at")
    SELECT r."order_id", q."id", r."comment", r."created_at"
    FROM "reviews" r
    JOIN "review_questions" q ON q."key" = 'additional_thoughts'
    WHERE r."comment" IS NOT NULL AND btrim(r."comment") <> ''
    ON CONFLICT ("order_id", "question_id") DO NOTHING;

    DROP TABLE "reviews";
  END IF;
END $$;
