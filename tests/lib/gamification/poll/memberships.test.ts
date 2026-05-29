import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import { upsertIdentity } from "@/lib/gamification/identity";
import { applyConsent } from "@/lib/gamification/consent";

// Mock yogoFetch
vi.mock("@/lib/yogo/fetch", () => ({
  yogoFetch: vi.fn(),
}));

import { pollMemberships } from "@/lib/gamification/poll/memberships";
import { yogoFetch } from "@/lib/yogo/fetch";

const CID_RENEW = 90040;
const CID_CANCEL = 90041;
const CID_DUNNING = 90042;
const CID_NEW = 90043;
const CID_AGG = 90044;
const CID_NO_ID = 99999;

const mockedYogoFetch = vi.mocked(yogoFetch);

async function cleanup() {
  for (const id of [CID_RENEW, CID_CANCEL, CID_DUNNING, CID_NEW]) {
    await db.gamificationEventLog.deleteMany({ where: { customerId: id } });
    await db.gamificationState.deleteMany({ where: { customerId: id } });
    await db.gamificationIdentity.deleteMany({ where: { customerId: id } });
  }
  // Clean all membership snapshots for test IDs
  await db.yogoMembershipSnapshot.deleteMany({
    where: { userId: { in: [CID_RENEW, CID_CANCEL, CID_DUNNING, CID_NEW] } },
  });
}

// Helper to create a previous-day snapshot
async function seedSnapshot(
  userId: number,
  date: string,
  data: {
    status?: string;
    statusText?: string;
    paidUntil?: string;
    membershipTypeId?: number;
    membershipTypeName?: string;
  },
) {
  await db.yogoMembershipSnapshot.upsert({
    where: { userId_snapshotDate: { userId, snapshotDate: date } },
    update: {
      status: data.status ?? "active",
      statusText: data.statusText ?? "",
      paidUntil: data.paidUntil ? new Date(data.paidUntil) : null,
      membershipTypeId: data.membershipTypeId ?? 1,
      membershipTypeName: data.membershipTypeName ?? "Mensal",
    },
    create: {
      userId,
      snapshotDate: date,
      status: data.status ?? "active",
      statusText: data.statusText ?? "",
      paidUntil: data.paidUntil ? new Date(data.paidUntil) : null,
      membershipTypeId: data.membershipTypeId ?? 1,
      membershipTypeName: data.membershipTypeName ?? "Mensal",
    },
  });
}

describe("pollMemberships", () => {
  beforeAll(async () => {
    await cleanup();

    // Set up identities with consent
    for (const id of [CID_RENEW, CID_CANCEL, CID_DUNNING, CID_NEW]) {
      await upsertIdentity({ customerId: id, phoneE164: `+3519110000${id}` });
      await applyConsent(id, { training: true, ugc: false, realName: false, broadcasts: false });
    }

    // Seed yesterday's snapshots
    await seedSnapshot(CID_RENEW, "2026-05-27", {
      status: "active",
      statusText: "",
      paidUntil: "2026-05-31",
    });
    await seedSnapshot(CID_CANCEL, "2026-05-27", {
      status: "active",
      statusText: "",
      paidUntil: "2026-06-30",
    });
    await seedSnapshot(CID_DUNNING, "2026-05-27", {
      status: "active",
      statusText: "",
      paidUntil: "2026-06-30",
    });
    // CID_NEW has no previous snapshot
  });

  afterAll(cleanup);

  it("detects renewal — paid_until advanced ≥25 days", async () => {
    mockedYogoFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: [
        {
          user_id: CID_RENEW,
          user_email: "renew@test.com",
          membership_type_id: 1,
          membership_type_name: "Mensal",
          status: "active",
          status_text: "",
          paid_until: "2026-06-30", // advanced from May 31 → June 30 = 30 days
          next_payment_date: "2026-07-01",
        },
      ],
      rawText: "",
    });

    const result = await pollMemberships();
    expect(result.renewed).toBe(1);
    expect(result.snapshotsUpserted).toBe(1);

    const event = await db.gamificationEventLog.findFirst({
      where: { customerId: CID_RENEW, eventType: "subscription_renewed" },
    });
    expect(event).not.toBeNull();
    const payload = JSON.parse(event!.payloadJson ?? "{}");
    expect(payload.daysAdvanced).toBeGreaterThanOrEqual(25);
  });

  it("detects cancellation — status changed to ended", async () => {
    mockedYogoFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: [
        {
          user_id: CID_CANCEL,
          user_email: "cancel@test.com",
          membership_type_id: 1,
          membership_type_name: "Mensal",
          status: "ended",
          status_text: "",
          paid_until: "2026-05-31",
          next_payment_date: null,
        },
      ],
      rawText: "",
    });

    const result = await pollMemberships();
    expect(result.cancelled).toBe(1);

    const event = await db.gamificationEventLog.findFirst({
      where: { customerId: CID_CANCEL, eventType: "subscription_cancelled" },
    });
    expect(event).not.toBeNull();
  });

  it("detects dunning — status_text newly matches dunning pattern", async () => {
    mockedYogoFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: [
        {
          user_id: CID_DUNNING,
          user_email: "dunning@test.com",
          membership_type_id: 1,
          membership_type_name: "Mensal",
          status: "active",
          status_text: "Pausado. Renovação automática falhou 4 vezes.",
          paid_until: "2026-06-30",
          next_payment_date: null,
        },
      ],
      rawText: "",
    });

    const result = await pollMemberships();
    expect(result.dunningDetected).toBe(1);

    const event = await db.gamificationEventLog.findFirst({
      where: { customerId: CID_DUNNING, eventType: "dunning_detected" },
    });
    expect(event).not.toBeNull();
    const payload = JSON.parse(event!.payloadJson ?? "{}");
    expect(payload.statusText).toContain("falhou");
  });

  it("new customer produces 0 trigger events (no previous snapshot)", async () => {
    mockedYogoFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: [
        {
          user_id: CID_NEW,
          user_email: "new@test.com",
          membership_type_id: 1,
          membership_type_name: "Mensal",
          status: "active",
          status_text: "",
          paid_until: "2026-06-30",
          next_payment_date: "2026-07-01",
        },
      ],
      rawText: "",
    });

    const result = await pollMemberships();
    expect(result.renewed).toBe(0);
    expect(result.cancelled).toBe(0);
    expect(result.dunningDetected).toBe(0);
    expect(result.skippedFirstObservation).toBe(1);
    expect(result.snapshotsUpserted).toBe(1);
  });

  it("filters aggregator accounts", async () => {
    mockedYogoFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: [
        {
          user_id: CID_NO_ID,
          user_email: "usc-abc@urbansportsclub.com",
          membership_type_id: 1,
          membership_type_name: "USC",
          status: "active",
          status_text: "",
          paid_until: "2026-06-30",
          next_payment_date: null,
        },
      ],
      rawText: "",
    });

    const result = await pollMemberships();
    expect(result.skippedAggregator).toBe(1);
  });

  it("is idempotent — same snapshot twice produces 0 new events", async () => {
    // Re-poll with same data as the renewal test
    mockedYogoFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: [
        {
          user_id: CID_RENEW,
          user_email: "renew@test.com",
          membership_type_id: 1,
          membership_type_name: "Mensal",
          status: "active",
          status_text: "",
          paid_until: "2026-06-30",
          next_payment_date: "2026-07-01",
        },
      ],
      rawText: "",
    });

    const result = await pollMemberships();
    expect(result.renewed).toBe(0); // same idempotency key → no new event
  });

  it("throws on Yogo API failure", async () => {
    mockedYogoFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      data: null,
      rawText: "Internal Server Error",
    });

    await expect(pollMemberships()).rejects.toThrow("Yogo memberships fetch failed");
  });
});
