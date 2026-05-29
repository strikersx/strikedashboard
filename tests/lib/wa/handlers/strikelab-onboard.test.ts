import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";

// Mock Yogo lookup
vi.mock("@/lib/yogo/lookup", () => ({
  findCustomerByPhone: vi.fn(),
  getYogoUserDetail: vi.fn(),
  clearCustomerCache: vi.fn(),
}));

// Mock WA meta (sendText/sendButton)
vi.mock("@/lib/wa/meta", () => ({
  sendText: vi.fn().mockResolvedValue({ ok: true }),
  sendButton: vi.fn().mockResolvedValue({ ok: true }),
}));

// Mock yogoFetch to prevent DB URL requirement in transitive imports
vi.mock("@/lib/yogo/fetch", () => ({
  yogoFetch: vi.fn(),
}));

import { handleStrikelabOnboard, handleStrikelabConsent } from "@/lib/wa/handlers/strikelab-onboard";
import { findCustomerByPhone, getYogoUserDetail } from "@/lib/yogo/lookup";
import { sendText, sendButton } from "@/lib/wa/meta";

const mockedFindCustomer = vi.mocked(findCustomerByPhone);
const mockedGetUserDetail = vi.mocked(getYogoUserDetail);
const mockedSendText = vi.mocked(sendText);
const mockedSendButton = vi.mocked(sendButton);

function makeSession(phone: string, state = "IDLE") {
  return {
    phoneE164: phone,
    state,
    pendingClassId: null,
    pendingSignupId: null,
    pendingSongClassId: null,
    pendingTrackId: null,
    expiresAt: null,
    version: 1,
  };
}

const CID_ADULT = 90050;
const CID_MINOR = 90051;
const CID_NO_DOB = 90052;
const CID_YOUNG = 90053;
const PHONE_ADULT = "+351911000050";
const PHONE_MINOR = "+351911000051";
const PHONE_NO_DOB = "+351911000052";
const PHONE_YOUNG = "+351911000053";

async function cleanup() {
  for (const id of [CID_ADULT, CID_MINOR, CID_NO_DOB, CID_YOUNG]) {
    await db.gamificationEventLog.deleteMany({ where: { customerId: id } });
    await db.gamificationState.deleteMany({ where: { customerId: id } });
    await db.gamificationIdentity.deleteMany({ where: { customerId: id } });
  }
  for (const phone of [PHONE_ADULT, PHONE_MINOR]) {
    await db.waSession.deleteMany({ where: { phoneE164: phone } });
    await db.waOutbound.deleteMany({ where: { phoneE164: phone } });
    await db.waInbound.deleteMany({ where: { phoneE164: phone } });
    await db.waContact.deleteMany({ where: { phoneE164: phone } });
  }
}

async function seedWaSession(phone: string, version = 1) {
  await db.waContact.upsert({
    where: { phoneE164: phone },
    create: { phoneE164: phone },
    update: {},
  });
  await db.waSession.upsert({
    where: { phoneE164: phone },
    create: { phoneE164: phone, state: "IDLE", version },
    update: { state: "IDLE", version },
  });
}

describe("strikelab-onboard", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("handleStrikelabOnboard", () => {
    it("refuses if no Yogo customer found", async () => {
      mockedFindCustomer.mockResolvedValueOnce(null);
      await handleStrikelabOnboard(makeSession(PHONE_ADULT));

      expect(mockedSendText).toHaveBeenCalledWith(
        PHONE_ADULT,
        expect.stringContaining("Marcelo"),
      );
    });

    it("refuses if Yogo DOB is null", async () => {
      mockedFindCustomer.mockResolvedValueOnce({
        id: CID_NO_DOB,
        phone: PHONE_NO_DOB,
        email: "nodob@test.com",
      });
      mockedGetUserDetail.mockResolvedValueOnce({
        id: CID_NO_DOB,
        date_of_birth: null,
      });

      await handleStrikelabOnboard(makeSession(PHONE_NO_DOB));

      expect(mockedSendText).toHaveBeenCalledWith(
        PHONE_NO_DOB,
        expect.stringContaining("actualiza a tua data de nascimento"),
      );
    });

    it("excludes users under 13", async () => {
      mockedFindCustomer.mockResolvedValueOnce({
        id: CID_YOUNG,
        phone: PHONE_YOUNG,
      });
      mockedGetUserDetail.mockResolvedValueOnce({
        id: CID_YOUNG,
        date_of_birth: "2020-01-01", // ~6 years old
      });

      await handleStrikelabOnboard(makeSession(PHONE_YOUNG));

      expect(mockedSendText).toHaveBeenCalledWith(
        PHONE_YOUNG,
        expect.stringContaining("idades 13+"),
      );
    });

    it("sends parental consent message for minors (13-17)", async () => {
      await seedWaSession(PHONE_MINOR);
      mockedFindCustomer.mockResolvedValueOnce({
        id: CID_MINOR,
        phone: PHONE_MINOR,
        email: "minor@test.com",
      });
      mockedGetUserDetail.mockResolvedValueOnce({
        id: CID_MINOR,
        date_of_birth: "2012-01-01", // ~14 years old
      });

      await handleStrikelabOnboard(makeSession(PHONE_MINOR));

      expect(mockedSendText).toHaveBeenCalledWith(
        PHONE_MINOR,
        expect.stringContaining("encarregado de educação"),
      );

      // Verify identity was created with birthYear
      const identity = await db.gamificationIdentity.findUnique({
        where: { customerId: CID_MINOR },
      });
      expect(identity?.birthYear).toBe(2012);
    });

    it("sends consent buttons for adults (≥18)", async () => {
      await seedWaSession(PHONE_ADULT);
      mockedFindCustomer.mockResolvedValueOnce({
        id: CID_ADULT,
        phone: PHONE_ADULT,
        email: "adult@test.com",
      });
      mockedGetUserDetail.mockResolvedValueOnce({
        id: CID_ADULT,
        date_of_birth: "1995-06-15",
      });

      await handleStrikelabOnboard(makeSession(PHONE_ADULT));

      expect(mockedSendButton).toHaveBeenCalledWith(
        PHONE_ADULT,
        expect.stringContaining("StrikeLab"),
        expect.objectContaining({ id: "strikelab_accept" }),
        expect.objectContaining({ id: "strikelab_decline" }),
      );

      // Verify identity was created
      const identity = await db.gamificationIdentity.findUnique({
        where: { customerId: CID_ADULT },
      });
      expect(identity).not.toBeNull();
      expect(identity?.birthYear).toBe(1995);
    });
  });

  describe("handleStrikelabConsent", () => {
    it("decline → resets to IDLE with polite message", async () => {
      await seedWaSession(PHONE_ADULT);
      await handleStrikelabConsent(makeSession(PHONE_ADULT), "strikelab_decline");

      expect(mockedSendText).toHaveBeenCalledWith(
        PHONE_ADULT,
        expect.stringContaining("mudares de ideia"),
      );
    });

    it("accept → applies consent + emits identity_created event", async () => {
      await seedWaSession(PHONE_ADULT);
      // Identity should already exist from the adult test above
      await handleStrikelabConsent(makeSession(PHONE_ADULT), "strikelab_accept");

      // Verify consent was applied
      const identity = await db.gamificationIdentity.findUnique({
        where: { customerId: CID_ADULT },
      });
      expect(identity?.consentTraining).toBe(true);
      expect(identity?.optInAt).not.toBeNull();

      // Verify event was emitted
      const event = await db.gamificationEventLog.findFirst({
        where: { customerId: CID_ADULT, eventType: "identity_created" },
      });
      expect(event).not.toBeNull();

      // Verify welcome message
      expect(mockedSendText).toHaveBeenCalledWith(
        PHONE_ADULT,
        expect.stringContaining("Bem-vindo ao StrikeLab"),
      );
    });
  });
});
