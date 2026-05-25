import { describe, expect, it } from "vitest";
import { isoLisbonDate, lisbonHour } from "../../../src/lib/wa/lisbon";

describe("lisbonHour", () => {
  it("returns 11 when UTC is 10:00 in summer (DST: WEST = UTC+1)", () => {
    // 2026-07-15 is in summer DST.
    const summerNoon = new Date("2026-07-15T10:00:00Z");
    expect(lisbonHour(summerNoon)).toBe(11);
  });

  it("returns 11 when UTC is 11:00 in winter (no DST: WET = UTC+0)", () => {
    // 2026-01-15 is winter (no DST).
    const winterMorning = new Date("2026-01-15T11:00:00Z");
    expect(lisbonHour(winterMorning)).toBe(11);
  });

  it("returns 10 when UTC is 10:00 in winter (UTC+0)", () => {
    const winterMorning = new Date("2026-01-15T10:00:00Z");
    expect(lisbonHour(winterMorning)).toBe(10);
  });

  it("returns 12 when UTC is 11:00 in summer (UTC+1)", () => {
    const summerMorning = new Date("2026-07-15T11:00:00Z");
    expect(lisbonHour(summerMorning)).toBe(12);
  });
});

describe("isoLisbonDate", () => {
  it("returns Lisbon-local date for a UTC instant straddling midnight (summer)", () => {
    // 2026-07-15 23:30 UTC = 2026-07-16 00:30 Lisbon (UTC+1)
    const lateNightUtc = new Date("2026-07-15T23:30:00Z");
    expect(isoLisbonDate(lateNightUtc)).toBe("2026-07-16");
  });

  it("returns Lisbon-local date for early-morning UTC (winter, no shift)", () => {
    const earlyWinterUtc = new Date("2026-01-15T01:00:00Z");
    expect(isoLisbonDate(earlyWinterUtc)).toBe("2026-01-15");
  });
});
