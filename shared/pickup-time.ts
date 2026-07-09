/** Pacific wall-clock pickup times (no date component). */
export const PACIFIC_TZ = "America/Los_Angeles";

/** Normalize to HH:MM:SS for database storage. */
export function normalizePickupTime(time: string): string {
  const parts = time.trim().split(":");
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  const seconds = parts[2] !== undefined ? Number(parts[2]) : 0;

  if (
    [hours, minutes, seconds].some((n) => Number.isNaN(n)) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return "";
  }

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0"),
  ].join(":");
}

/** Format stored pickup time for display (e.g. 4:00 PM PT). */
export function formatPickupTime(time: string): string {
  const normalized = normalizePickupTime(time);
  if (!normalized) {
    return time;
  }

  const [hours, minutes] = normalized.split(":").map(Number);
  const date = new Date(2000, 0, 1, hours, minutes);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function comparePickupTime(a: string, b: string): number {
  return normalizePickupTime(a).localeCompare(normalizePickupTime(b));
}
