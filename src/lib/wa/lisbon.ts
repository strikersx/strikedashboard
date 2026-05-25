// Europe/Lisbon hour gate. Vercel crons run in UTC. We schedule two entries
// (0 10 UTC and 0 11 UTC) so one always fires at 11h Lisbon -- WEST (UTC+1)
// in summer makes 10 UTC = 11h Lisbon; WET (UTC+0) in winter makes 11 UTC =
// 11h Lisbon. The route exits early if the current Lisbon hour isn't 11,
// so we never send the trial follow-up twice per day.

const FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Lisbon",
  hour: "2-digit",
  hour12: false,
});

export function lisbonHour(now: Date = new Date()): number {
  return Number(FORMAT.format(now));
}

export function isoLisbonDate(now: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" });
  return fmt.format(now); // YYYY-MM-DD
}
