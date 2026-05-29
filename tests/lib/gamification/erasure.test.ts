import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { upsertIdentity } from "@/lib/gamification/identity";
import { applyConsent } from "@/lib/gamification/consent";
import { appendEvent } from "@/lib/gamification/event-log";
import { executeTrackA, executeTrackB } from "@/lib/gamification/erasure";

const CID = 90060;

async function cleanup() {
  await db.gamificationMonthlySnapshot.deleteMany({ where: { customerId: CID } });
  await db.gamificationEventLog.deleteMany({ where: { customerId: CID } });
  await db.gamificationState.deleteMany({ where: { customerId: CID } });
  await db.gamificationIdentity.deleteMany({ where: { customerId: CID } });
}

describe("erasure flow", () => {
  beforeAll(async () => {
    await cleanup();

    // Set up a full identity with consent and events
    await upsertIdentity({ customerId: CID, phoneE164: "+351911000060", email: "erase@test.com" });
    await applyConsent(CID, { training: true, ugc: true, realName: false, broadcasts: false });
    await appendEvent({
      customerId: CID,
      eventType: "checkin_observed",
      pointsDelta: 10,
      xpDelta: 5,
      idempotencyKey: `test:erasure:checkin:${CID}:1`,
      payloadJson: { classId: 42, className: "Muay Thai" },
    });
  });

  afterAll(cleanup);

  describe("Track A — pseudonymisation", () => {
    it("tombstones identity with erasedAt", async () => {
      const result = await executeTrackA(CID, 1);

      expect(result.customerId).toBe(CID);
      expect(result.eventsAnonymised).toBeGreaterThanOrEqual(1);
      expect(result.stateZeroed).toBe(true);

      const identity = await db.gamificationIdentity.findUnique({
        where: { customerId: CID },
      });
      expect(identity?.erasedAt).not.toBeNull();
      expect(identity?.email).toBeNull();
      expect(identity?.consentTraining).toBe(false);
    });

    it("anonymises event payloads", async () => {
      const event = await db.gamificationEventLog.findFirst({
        where: { customerId: CID, eventType: "checkin_observed" },
      });
      const payload = JSON.parse(event!.payloadJson ?? "{}");
      expect(payload.anonymised).toBe(true);
      expect(payload.className).toBeUndefined();
    });

    it("zeros state", async () => {
      const state = await db.gamificationState.findUnique({
        where: { customerId: CID },
      });
      expect(state?.monthlyPoints).toBe(0);
      expect(state?.lifetimeXp).toBe(0);
    });

    it("emits erasure_executed audit event", async () => {
      const event = await db.gamificationEventLog.findFirst({
        where: { customerId: CID, eventType: "erasure_executed" },
      });
      expect(event).not.toBeNull();
      const payload = JSON.parse(event!.payloadJson ?? "{}");
      expect(payload.track).toBe("A");
    });

    it("rejects double Track A", async () => {
      await expect(executeTrackA(CID, 1)).rejects.toThrow("already erased");
    });
  });

  describe("Track B — full anonymisation", () => {
    it("rejects Track B without Track A", async () => {
      // Use a different customer that hasn't been erased
      const CID_B = 90061;
      await upsertIdentity({ customerId: CID_B, phoneE164: "+351911000061" });

      await expect(executeTrackB(CID_B, 1)).rejects.toThrow("Track A first");

      // Cleanup
      await db.gamificationIdentity.deleteMany({ where: { customerId: CID_B } });
    });

    it("rejects Track B within 12 months of Track A", async () => {
      await expect(executeTrackB(CID, 1)).rejects.toThrow("12 months");
    });
  });
});
