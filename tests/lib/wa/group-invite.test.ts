import { describe, expect, it } from "vitest";
import { idempotencyAllows } from "../../../src/lib/wa/group-invite";

describe("idempotencyAllows", () => {
  const now = new Date("2026-05-27T10:00:00.000Z");

  it("allows when no prior send", () => {
    expect(idempotencyAllows(now, null, false)).toEqual({ allowed: true });
  });

  it("blocks when last send was 3 days ago", () => {
    const lastSentAt = new Date("2026-05-24T10:00:00.000Z");
    expect(idempotencyAllows(now, lastSentAt, false)).toEqual({
      allowed: false,
      daysSince: 3,
    });
  });

  it("blocks when last send was 29 days ago (still inside window)", () => {
    const lastSentAt = new Date("2026-04-28T10:00:00.000Z");
    expect(idempotencyAllows(now, lastSentAt, false)).toEqual({
      allowed: false,
      daysSince: 29,
    });
  });

  it("allows when last send was 31 days ago", () => {
    const lastSentAt = new Date("2026-04-26T10:00:00.000Z");
    expect(idempotencyAllows(now, lastSentAt, false)).toEqual({ allowed: true });
  });

  it("allows when force=true regardless of recency", () => {
    const lastSentAt = new Date("2026-05-26T10:00:00.000Z");
    expect(idempotencyAllows(now, lastSentAt, true)).toEqual({ allowed: true });
  });
});
