import { describe, it, expect } from "vitest";
import { classify, type YogoMembership } from "@/lib/yogo/classify";
import { pickBestMembership } from "@/lib/yogo/pick-best-membership";
import { isNonActionableLead } from "@/lib/yogo/non-actionable-lead";

const TODAY = "2026-05-28";

describe("classify()", () => {
  it("active — paying, no issues", () => {
    const m: YogoMembership = {
      status: "active",
      status_text: "",
      paid_until: "2026-06-30",
    };
    expect(classify(m, TODAY)).toBe("active");
  });

  it("cancelled — status=ended", () => {
    const m: YogoMembership = {
      status: "ended",
      status_text: "",
      paid_until: "2026-03-31",
    };
    expect(classify(m, TODAY)).toBe("cancelled");
  });

  it("expired — paid_until in the past", () => {
    const m: YogoMembership = {
      status: "active",
      status_text: "",
      paid_until: "2026-04-30",
    };
    expect(classify(m, TODAY)).toBe("expired");
  });

  it("paused — explicit pause", () => {
    const m: YogoMembership = {
      status: "active",
      status_text: "Pausado",
      paid_until: "2026-06-30",
    };
    expect(classify(m, TODAY)).toBe("paused");
  });

  it("dunning — 'falhou' in status_text", () => {
    const m: YogoMembership = {
      status: "active",
      status_text: "Renovação automática falhou 2 vezes.",
      paid_until: "2026-06-30",
    };
    expect(classify(m, TODAY)).toBe("dunning");
  });

  it("paused — real Spike 2 case: dunning + paused", () => {
    // user_id 1174940 — the exact case from production
    const m: YogoMembership = {
      status: "active",
      status_text: "Pausado. Renovação automática falhou 4 vezes.",
      paid_until: "2026-03-31",
      next_payment: { date: "2026-04-01" },
    };
    expect(classify(m, "2026-05-28")).toBe("paused");
  });

  it("trial — class pass type", () => {
    const m: YogoMembership = {
      status: "active",
      status_text: "",
      paid_until: "2026-06-30",
      membership_type: { id: 99, name: "Class Pass 10" },
    };
    expect(classify(m, TODAY)).toBe("trial");
  });
});

describe("pickBestMembership()", () => {
  it("returns null for empty array", () => {
    expect(pickBestMembership([], TODAY)).toBeNull();
  });

  it("picks active over expired", () => {
    const active: YogoMembership = {
      status: "active",
      status_text: "",
      paid_until: "2026-06-30",
    };
    const expired: YogoMembership = {
      status: "active",
      status_text: "",
      paid_until: "2026-04-30",
    };
    const best = pickBestMembership([expired, active], TODAY);
    expect(best?.paid_until).toBe("2026-06-30");
  });

  it("picks paused over cancelled", () => {
    const paused: YogoMembership = {
      status: "active",
      status_text: "Pausado",
      paid_until: "2026-06-30",
    };
    const cancelled: YogoMembership = {
      status: "ended",
      status_text: "",
      paid_until: "2026-03-31",
    };
    const best = pickBestMembership([cancelled, paused], TODAY);
    expect(best?.status_text).toBe("Pausado");
  });
});

describe("isNonActionableLead()", () => {
  it("filters USC aggregator emails", () => {
    expect(isNonActionableLead("usc-abc123@urbansportsclub.com")).toBe(true);
  });

  it("filters internal strikershouse emails", () => {
    expect(isNonActionableLead("test@strikershouse.pt")).toBe(true);
  });

  it("passes through normal emails", () => {
    expect(isNonActionableLead("joao@gmail.com")).toBe(false);
  });

  it("passes through null/undefined", () => {
    expect(isNonActionableLead(null)).toBe(false);
    expect(isNonActionableLead(undefined)).toBe(false);
  });

  it("filters ClassPass emails", () => {
    expect(isNonActionableLead("user@classpass.com")).toBe(true);
  });
});
