/** First 30 minutes after batch activation: priority for less-frequent customers. */
export const SIGNUP_PRIORITY_WINDOW_MS = 30 * 60 * 1000;

export const FREQUENT_ORDER_THRESHOLD = 3;
export const FREQUENT_LOOKBACK_BATCHES = 6;

export function getPriorityWindowEndsAt(
  activatedAt: Date | string | null | undefined,
): Date | null {
  if (!activatedAt) {
    return null;
  }
  const start = activatedAt instanceof Date ? activatedAt : new Date(activatedAt);
  if (Number.isNaN(start.getTime())) {
    return null;
  }
  return new Date(start.getTime() + SIGNUP_PRIORITY_WINDOW_MS);
}

export function getPriorityRetryAfterSeconds(
  activatedAt: Date | string | null | undefined,
  now: Date = new Date(),
): number {
  const endsAt = getPriorityWindowEndsAt(activatedAt);
  if (!endsAt) {
    return 0;
  }
  return Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / 1000));
}

export function isInSignupPriorityWindow(
  activatedAt: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  return getPriorityRetryAfterSeconds(activatedAt, now) > 0;
}

export function formatRetryAfterMinutes(retryAfterSeconds: number): number {
  return Math.max(1, Math.ceil(retryAfterSeconds / 60));
}

export function priorityWaitMessage(retryAfterSeconds: number): string {
  const mins = formatRetryAfterMinutes(retryAfterSeconds);
  return `Please try again in ${mins} minute${mins === 1 ? "" : "s"}. We're giving first dibs to folks who haven't ordered as often.`;
}
