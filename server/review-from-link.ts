import { submitReviewSchema, type Review, type ReviewQuestion } from "@shared/schema";
import { resolveReviewLinkSecret, verifyReviewToken } from "@shared/review-link";
import type { IStorage } from "./storage";
import type { OrderWithCustomer, Pizza } from "@shared/schema";

export type ReviewLinkContext = {
  order: OrderWithCustomer;
  pizza: Pizza;
  alreadyReviewed: boolean;
  questions: ReviewQuestion[];
};

export type ReviewLinkResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

function reviewSecrets(env: {
  REVIEW_LINK_SECRET?: string;
  ADMIN_PASSWORD?: string;
}): string | undefined {
  return resolveReviewLinkSecret(env.REVIEW_LINK_SECRET, env.ADMIN_PASSWORD);
}

export async function getReviewLinkContext(
  storage: IStorage,
  token: string,
  env: { REVIEW_LINK_SECRET?: string; ADMIN_PASSWORD?: string },
): Promise<ReviewLinkResult<ReviewLinkContext>> {
  const secret = reviewSecrets(env);
  const verified = await verifyReviewToken(token, secret);
  if (!verified.ok) {
    return { ok: false, status: 401, error: "This review link is invalid." };
  }

  const order = await storage.getOrderById(verified.orderId);
  if (!order) {
    return { ok: false, status: 404, error: "Order not found" };
  }

  if (order.status === "cancelled") {
    return { ok: false, status: 410, error: "This order was cancelled." };
  }

  const pizza = await storage.getPizzaById(order.pizzaId);
  if (!pizza) {
    return { ok: false, status: 404, error: "Pizza not found" };
  }

  const [existing, questions] = await Promise.all([
    storage.getReviewByOrderId(order.id),
    storage.getReviewQuestions(),
  ]);

  return {
    ok: true,
    data: {
      order,
      pizza,
      alreadyReviewed: Boolean(existing),
      questions,
    },
  };
}

export async function createReviewFromLink(
  storage: IStorage,
  token: string,
  reviewBody: Record<string, unknown>,
  env: { REVIEW_LINK_SECRET?: string; ADMIN_PASSWORD?: string },
): Promise<ReviewLinkResult<Review>> {
  const secret = reviewSecrets(env);
  const verified = await verifyReviewToken(token, secret);
  if (!verified.ok) {
    return { ok: false, status: 401, error: "This review link is invalid." };
  }

  const order = await storage.getOrderById(verified.orderId);
  if (!order) {
    return { ok: false, status: 404, error: "Order not found" };
  }

  if (order.status === "cancelled") {
    return { ok: false, status: 410, error: "This order was cancelled." };
  }

  const existing = await storage.getReviewByOrderId(order.id);
  if (existing) {
    return {
      ok: false,
      status: 410,
      error: "This review link has already been used.",
    };
  }

  const review = submitReviewSchema.parse({
    ...reviewBody,
    orderId: order.id,
  });

  try {
    const created = await storage.createReview(review);
    return { ok: true, data: created };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create review";
    if (message.includes("already submitted")) {
      return { ok: false, status: 410, error: "This review link has already been used." };
    }
    return { ok: false, status: 400, error: message };
  }
}
