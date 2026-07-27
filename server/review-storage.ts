import { and, asc, eq, inArray } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import type {
  Review,
  ReviewAnswer,
  ReviewQuestion,
  SubmitReviewRequest,
} from "@shared/schema";

type SchemaDb =
  | NeonHttpDatabase<typeof schema>
  | NodePgDatabase<typeof schema>
  | NodePgDatabase<Record<string, unknown>>;

function parseOptions(options: string | null): string[] {
  if (!options) return [];
  try {
    const parsed = JSON.parse(options);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function aggregateReviews(
  rows: Array<{
    answer: ReviewAnswer;
    question: ReviewQuestion;
    order: typeof schema.orders.$inferSelect;
    customer: typeof schema.customers.$inferSelect;
  }>,
): Review[] {
  const byOrder = new Map<
    string,
    {
      orderId: string;
      pizzaId: string;
      author: string;
      answers: Review["answers"];
      createdAt: Date;
    }
  >();

  for (const row of rows) {
    let entry = byOrder.get(row.order.id);
    if (!entry) {
      entry = {
        orderId: row.order.id,
        pizzaId: row.order.pizzaId,
        author: row.customer.name || "Guest",
        answers: [],
        createdAt: row.answer.createdAt,
      };
      byOrder.set(row.order.id, entry);
    }
    if (row.answer.createdAt < entry.createdAt) {
      entry.createdAt = row.answer.createdAt;
    }
    entry.answers.push({
      questionId: row.question.id,
      questionKey: row.question.key,
      prompt: row.question.prompt,
      value: row.answer.value,
    });
  }

  return Array.from(byOrder.values()).map((entry) => {
    const ratingRaw = entry.answers.find((a) => a.questionKey === "star_rating")?.value;
    const comment =
      entry.answers.find((a) => a.questionKey === "additional_thoughts")?.value ?? "";
    const rating = Number.parseInt(ratingRaw ?? "0", 10);
    return {
      orderId: entry.orderId,
      pizzaId: entry.pizzaId,
      author: entry.author,
      rating: Number.isFinite(rating) ? rating : 0,
      comment,
      answers: entry.answers,
      createdAt: entry.createdAt.toISOString(),
    };
  });
}

export async function selectActiveReviewQuestions(
  db: SchemaDb,
): Promise<ReviewQuestion[]> {
  return db
    .select()
    .from(schema.reviewQuestions)
    .where(eq(schema.reviewQuestions.active, true))
    .orderBy(asc(schema.reviewQuestions.sortOrder));
}

export async function selectAllReviewQuestions(
  db: SchemaDb,
): Promise<ReviewQuestion[]> {
  return db
    .select()
    .from(schema.reviewQuestions)
    .orderBy(asc(schema.reviewQuestions.sortOrder));
}

async function selectAnswerRows(
  db: SchemaDb,
  orderIds?: string[],
  pizzaId?: string,
) {
  const conditions = [];
  if (orderIds && orderIds.length > 0) {
    conditions.push(inArray(schema.reviewAnswers.orderId, orderIds));
  }
  if (pizzaId) {
    conditions.push(eq(schema.orders.pizzaId, pizzaId));
  }

  return db
    .select({
      answer: schema.reviewAnswers,
      question: schema.reviewQuestions,
      order: schema.orders,
      customer: schema.customers,
    })
    .from(schema.reviewAnswers)
    .innerJoin(
      schema.reviewQuestions,
      eq(schema.reviewAnswers.questionId, schema.reviewQuestions.id),
    )
    .innerJoin(schema.orders, eq(schema.reviewAnswers.orderId, schema.orders.id))
    .innerJoin(schema.customers, eq(schema.orders.customerId, schema.customers.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined);
}

export async function selectReviews(db: SchemaDb): Promise<Review[]> {
  const rows = await selectAnswerRows(db);
  return aggregateReviews(rows);
}

export async function selectReviewsByPizzaId(
  db: SchemaDb,
  pizzaId: string,
): Promise<Review[]> {
  const rows = await selectAnswerRows(db, undefined, pizzaId);
  return aggregateReviews(rows);
}

export async function selectReviewByOrderId(
  db: SchemaDb,
  orderId: string,
): Promise<Review | undefined> {
  const rows = await selectAnswerRows(db, [orderId]);
  return aggregateReviews(rows)[0];
}

export async function hasReviewForOrder(
  db: SchemaDb,
  orderId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.reviewAnswers.id })
    .from(schema.reviewAnswers)
    .where(eq(schema.reviewAnswers.orderId, orderId))
    .limit(1);
  return Boolean(row);
}

export async function selectReviewedOrderIds(db: SchemaDb): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ orderId: schema.reviewAnswers.orderId })
    .from(schema.reviewAnswers);
  return new Set(rows.map((r: { orderId: string }) => r.orderId));
}

export async function insertReviewAnswers(
  db: SchemaDb,
  request: SubmitReviewRequest,
): Promise<Review> {
  const questions = await selectAllReviewQuestions(db);
  const byId = new Map(questions.map((q) => [q.id, q]));
  const byKey = new Map(questions.map((q) => [q.key, q]));

  const resolved: Array<{ questionId: string; value: string }> = [];
  const seenQuestionIds = new Set<string>();

  for (const answer of request.answers) {
    const question = answer.questionId
      ? byId.get(answer.questionId)
      : answer.questionKey
        ? byKey.get(answer.questionKey)
        : undefined;
    if (!question) {
      throw new Error(
        `Unknown review question: ${answer.questionId || answer.questionKey}`,
      );
    }
    if (!question.active) {
      throw new Error(`Review question is inactive: ${question.key}`);
    }
    if (seenQuestionIds.has(question.id)) {
      throw new Error(`Duplicate answer for question: ${question.key}`);
    }

    let value = answer.value.trim();
    if (!value) {
      throw new Error(`Answer required for: ${question.key}`);
    }

    if (question.answerType === "stars") {
      const n = Number.parseInt(value, 10);
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        throw new Error("Star rating must be an integer from 1 to 5");
      }
      value = String(n);
    } else if (question.answerType === "choice") {
      const options = parseOptions(question.options);
      const isOtherAllowed = options.includes("Other");
      const exactMatch = options.includes(value);
      const otherMatch =
        isOtherAllowed &&
        (value === "Other" || value.startsWith("Other:"));
      if (!exactMatch && !otherMatch) {
        throw new Error(`Invalid choice for ${question.key}`);
      }
      if (value === "Other") {
        throw new Error(`Please enter a custom amount for ${question.key}`);
      }
    }

    seenQuestionIds.add(question.id);
    resolved.push({ questionId: question.id, value });
  }

  const activeRequired = questions.filter((q) => q.active && q.required);
  for (const q of activeRequired) {
    if (!seenQuestionIds.has(q.id)) {
      throw new Error(`Missing required answer: ${q.key}`);
    }
  }

  const already = await hasReviewForOrder(db, request.orderId);
  if (already) {
    throw new Error("Review already submitted for this order");
  }

  await db.insert(schema.reviewAnswers).values(
    resolved.map((a) => ({
      orderId: request.orderId,
      questionId: a.questionId,
      value: a.value,
    })),
  );

  const created = await selectReviewByOrderId(db, request.orderId);
  if (!created) {
    throw new Error("Failed to load created review");
  }
  return created;
}

export { parseOptions };
