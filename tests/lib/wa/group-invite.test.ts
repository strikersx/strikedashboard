import { describe, expect, it } from "vitest";
import {
  idempotencyAllows,
  formatInviteParams,
  summarizeDetails,
  type SendDetail,
} from "../../../src/lib/wa/group-invite";

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

describe("formatInviteParams", () => {
  it("returns first-name + url as Meta template body parameters", () => {
    expect(formatInviteParams("João", "https://chat.whatsapp.com/ABC")).toEqual([
      { type: "text", text: "João" },
      { type: "text", text: "https://chat.whatsapp.com/ABC" },
    ]);
  });

  it("uses the fallback name when name is empty/whitespace", () => {
    expect(formatInviteParams("   ", "https://example.com")[0]).toEqual({
      type: "text",
      text: "amigo",
    });
  });

  it("trims a multi-word name to the first token", () => {
    expect(formatInviteParams("Maria João Silva", "https://example.com")[0]).toEqual({
      type: "text",
      text: "Maria",
    });
  });
});

describe("summarizeDetails", () => {
  it("counts outcomes correctly", () => {
    const details: SendDetail[] = [
      { phoneE164: "+351911111111", outcome: "sent" },
      { phoneE164: "+351922222222", outcome: "sent" },
      { phoneE164: "+351933333333", outcome: "skipped", reason: "recently_invited_5_days" },
      { phoneE164: "+351944444444", outcome: "failed", reason: "wa_auth_fail" },
      { phoneE164: "+351955555555", outcome: "dry" },
    ];
    expect(summarizeDetails(details)).toEqual({
      total: 5,
      sent: 2,
      skipped: 1,
      failed: 1,
      dry: 1,
    });
  });

  it("returns zeros for empty input", () => {
    expect(summarizeDetails([])).toEqual({
      total: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      dry: 0,
    });
  });
});
