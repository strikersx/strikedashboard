import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  upsertIdentity,
  findByPhone,
  findByEmail,
  findByWaId,
  findByCustomerId,
  generateIgChallenge,
  verifyIgChallenge,
} from "@/lib/gamification/identity";

const CID1 = 90010;
const CID2 = 90011;

async function cleanup() {
  const ids = [CID1, CID2];
  for (const id of ids) {
    await db.gamificationEventLog.deleteMany({ where: { customerId: id } });
    await db.gamificationState.deleteMany({ where: { customerId: id } });
    await db.gamificationIdentity.deleteMany({ where: { customerId: id } });
  }
}

describe("identity resolution", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  describe("upsertIdentity + lookups", () => {
    it("creates a new identity", async () => {
      const identity = await upsertIdentity({
        customerId: CID1,
        phoneE164: "+351911000001",
        email: "Ricardo@Example.COM ",
      });

      expect(identity.customerId).toBe(CID1);
      expect(identity.phoneE164).toBe("+351911000001");
      expect(identity.email).toBe("ricardo@example.com"); // normalized
    });

    it("finds by phone", async () => {
      const found = await findByPhone("+351911000001");
      expect(found?.customerId).toBe(CID1);
    });

    it("finds by email (case-insensitive)", async () => {
      const found = await findByEmail("RICARDO@EXAMPLE.COM");
      expect(found?.customerId).toBe(CID1);
    });

    it("finds by customerId", async () => {
      const found = await findByCustomerId(CID1);
      expect(found?.phoneE164).toBe("+351911000001");
    });

    it("returns null for unknown phone", async () => {
      const found = await findByPhone("+351999999999");
      expect(found).toBeNull();
    });

    it("updates existing identity on re-upsert", async () => {
      await upsertIdentity({
        customerId: CID1,
        phoneE164: "+351911000001",
        whatsappWaId: "wa_12345",
      });

      const found = await findByWaId("wa_12345");
      expect(found?.customerId).toBe(CID1);
    });
  });

  describe("IG verification", () => {
    it("generates a 6-digit challenge code", async () => {
      await upsertIdentity({
        customerId: CID2,
        phoneE164: "+351911000002",
      });

      const code = await generateIgChallenge(CID2);
      expect(code).toMatch(/^\d{6}$/);

      const identity = await db.gamificationIdentity.findUnique({
        where: { customerId: CID2 },
      });
      expect(identity?.igChallengeCode).toBe(code);
      expect(identity?.igChallengeExpiry).not.toBeNull();
    });

    it("verifies correct code and sets IG handle", async () => {
      const code = await generateIgChallenge(CID2);
      const result = await verifyIgChallenge({
        customerId: CID2,
        code,
        igHandle: "@testuser",
      });

      expect(result.ok).toBe(true);

      const identity = await db.gamificationIdentity.findUnique({
        where: { customerId: CID2 },
      });
      expect(identity?.instagramHandle).toBe("@testuser");
      expect(identity?.igVerifiedAt).not.toBeNull();
      expect(identity?.igChallengeCode).toBeNull(); // cleared after use
    });

    it("rejects wrong code", async () => {
      await generateIgChallenge(CID2);
      const result = await verifyIgChallenge({
        customerId: CID2,
        code: "000000",
        igHandle: "@wrong",
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe("code_mismatch");
    });

    it("rejects unknown customer", async () => {
      const result = await verifyIgChallenge({
        customerId: 999999,
        code: "123456",
        igHandle: "@ghost",
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe("identity_not_found");
    });
  });
});
