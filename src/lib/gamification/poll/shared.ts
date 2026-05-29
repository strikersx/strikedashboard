/**
 * Shared helpers for Yogo poll modules (classes + memberships).
 */

/** Get current period "YYYY-MM" in Lisbon timezone. */
export function getCurrentPeriod(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
}

/** Get today's date "YYYY-MM-DD" in Lisbon timezone. */
export function getTodayISO(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Check if current Lisbon hour is within operating hours. */
export function isWithinOpsHours(startHour: number, endHour: number): boolean {
  const hour = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Lisbon",
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
    10,
  );
  return hour >= startHour && hour < endHour;
}
