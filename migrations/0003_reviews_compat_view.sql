-- Compatibility view for deployed code that still SELECTs from "reviews"
-- while the app migrates to review_questions / review_answers.
-- Safe to remove after the new review schema is deployed everywhere.

CREATE OR REPLACE VIEW "reviews" AS
SELECT
  (
    SELECT ra.id
    FROM review_answers ra
    WHERE ra.order_id = o.id
    ORDER BY ra.created_at ASC
    LIMIT 1
  ) AS id,
  o.id AS order_id,
  o.pizza_id AS pizza_id,
  COALESCE(
    (
      SELECT NULLIF(ra.value, '')::integer
      FROM review_answers ra
      INNER JOIN review_questions rq ON rq.id = ra.question_id
      WHERE ra.order_id = o.id AND rq.key = 'star_rating'
      LIMIT 1
    ),
    0
  ) AS rating,
  COALESCE(
    (
      SELECT ra.value
      FROM review_answers ra
      INNER JOIN review_questions rq ON rq.id = ra.question_id
      WHERE ra.order_id = o.id AND rq.key = 'additional_thoughts'
      LIMIT 1
    ),
    ''
  ) AS comment,
  COALESCE(c.name, 'Guest') AS author,
  (
    SELECT ra.value
    FROM review_answers ra
    INNER JOIN review_questions rq ON rq.id = ra.question_id
    WHERE ra.order_id = o.id AND rq.key = 'overall_rating'
    LIMIT 1
  ) AS overall_rating,
  (
    SELECT
      CASE
        WHEN ra.value LIKE 'Other:%' THEN 'Other'
        ELSE ra.value
      END
    FROM review_answers ra
    INNER JOIN review_questions rq ON rq.id = ra.question_id
    WHERE ra.order_id = o.id AND rq.key = 'fair_price'
    LIMIT 1
  ) AS fair_price,
  (
    SELECT
      CASE
        WHEN ra.value LIKE 'Other:%' THEN btrim(substring(ra.value from 7))
        ELSE NULL
      END
    FROM review_answers ra
    INNER JOIN review_questions rq ON rq.id = ra.question_id
    WHERE ra.order_id = o.id AND rq.key = 'fair_price'
    LIMIT 1
  ) AS custom_price_amount,
  (
    SELECT ra.value
    FROM review_answers ra
    INNER JOIN review_questions rq ON rq.id = ra.question_id
    WHERE ra.order_id = o.id AND rq.key = 'crust_flavor'
    LIMIT 1
  ) AS crust_flavor,
  (
    SELECT ra.value
    FROM review_answers ra
    INNER JOIN review_questions rq ON rq.id = ra.question_id
    WHERE ra.order_id = o.id AND rq.key = 'crust_quality'
    LIMIT 1
  ) AS crust_quality,
  (
    SELECT ra.value
    FROM review_answers ra
    INNER JOIN review_questions rq ON rq.id = ra.question_id
    WHERE ra.order_id = o.id AND rq.key = 'toppings_balance'
    LIMIT 1
  ) AS toppings_balance,
  (
    SELECT ra.value
    FROM review_answers ra
    INNER JOIN review_questions rq ON rq.id = ra.question_id
    WHERE ra.order_id = o.id AND rq.key = 'would_order_again'
    LIMIT 1
  ) AS would_order_again,
  (
    SELECT MIN(ra.created_at)
    FROM review_answers ra
    WHERE ra.order_id = o.id
  ) AS created_at
FROM orders o
INNER JOIN customers c ON c.id = o.customer_id
WHERE EXISTS (
  SELECT 1 FROM review_answers ra WHERE ra.order_id = o.id
);
