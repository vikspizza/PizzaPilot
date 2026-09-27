import type { Batch, SignupThrottleStage } from "@shared/schema";
import {
  getPriorityRetryAfterSeconds,
  isInSignupPriorityWindow,
  priorityWaitMessage,
} from "@shared/signup-throttle";
import type { IStorage } from "./storage";

export type SignupThrottleResult =
  | { ok: true }
  | {
      ok: false;
      status: number;
      error: string;
      retryAfterSeconds?: number;
      code?: "priority_window" | "not_activated";
    };

function normalizePhone10(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  return /^\d{10}$/.test(digits) ? digits : null;
}

/**
 * During the first 30 minutes after activation, frequent customers
 * (≥3 orders in last 6 batches) must wait. Invite codes bypass this.
 */
export async function assertSignupAllowed(
  storage: IStorage,
  batch: Batch,
  phone: string | undefined,
  options: { stage: SignupThrottleStage; inviteCode?: string },
): Promise<SignupThrottleResult> {
  if (!batch.activatedAt) {
    return {
      ok: false,
      status: 403,
      code: "not_activated",
      error: "Signup is not open for this batch yet.",
    };
  }

  if (options.inviteCode) {
    return { ok: true };
  }

  if (!isInSignupPriorityWindow(batch.activatedAt)) {
    return { ok: true };
  }

  const phone10 = phone ? normalizePhone10(phone) : null;
  if (!phone10) {
    return {
      ok: false,
      status: 400,
      error: "Phone number must be exactly 10 digits.",
    };
  }

  const frequent = await storage.isFrequentCustomer(phone10);
  if (!frequent) {
    return { ok: true };
  }

  const retryAfterSeconds = getPriorityRetryAfterSeconds(batch.activatedAt);
  try {
    await storage.recordSignupThrottle({
      batchId: batch.id,
      phone: phone10,
      stage: options.stage,
      retryAfterSeconds,
    });
  } catch (error) {
    // Logging must never block or break signup (e.g. table not yet migrated).
    console.warn("Failed to record signup throttle:", error);
  }

  return {
    ok: false,
    status: 403,
    code: "priority_window",
    retryAfterSeconds,
    error: priorityWaitMessage(retryAfterSeconds),
  };
}
