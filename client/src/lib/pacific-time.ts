/** Vik's Pizza service timezone (handles PST/PDT automatically). */
export { PACIFIC_TZ, comparePickupTime, formatPickupTime, normalizePickupTime } from "@shared/pickup-time";

import { PACIFIC_TZ } from "@shared/pickup-time";

/** Today's date (YYYY-MM-DD) in Pacific time — for admin defaults. */
export function todayPacificDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: PACIFIC_TZ }).format(new Date());
}

/** Format order date + pickup time for display (e.g. Fri, Jul 5, 2025, 4:00 PM PDT). */
export function formatOrderPickupDateTime(serviceDate: string, pickupTime: string): string {
  const [year, month, day] = serviceDate.split("-").map(Number);
  const [hours, minutes] = pickupTime.split(":").map(Number);
  if ([year, month, day, hours, minutes].some((n) => Number.isNaN(n))) {
    return `${serviceDate} ${pickupTime}`;
  }

  const date = new Date(year, month - 1, day, hours, minutes);
  const formatted = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);

  return `${formatted} PT`;
}
