import { describe, expect, it } from "vitest";
import { isCancellable, parseClassStart, type YogoSignup } from "../../../src/lib/yogo/signups";

function makeSignup(date: string, time: string, opts: Partial<YogoSignup> = {}): YogoSignup {
  return {
    id: 1,
    class: { id: 99, date, start_time: time },
    ...opts,
  } as YogoSignup;
}

describe("parseClassStart", () => {
  it("returns null on missing fields", () => {
    expect(parseClassStart(null)).toBeNull();
    expect(parseClassStart({ date: undefined, start_time: "19:30" })).toBeNull();
    expect(parseClassStart({ date: "2026-05-26", start_time: undefined })).toBeNull();
  });

  it("parses a valid date+time", () => {
    const d = parseClassStart({ date: "2026-05-26", start_time: "19:30" });
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(4);     // 0-based
    expect(d?.getDate()).toBe(26);
    expect(d?.getHours()).toBe(19);
    expect(d?.getMinutes()).toBe(30);
  });

  it("returns null on garbage", () => {
    expect(parseClassStart({ date: "garbage", start_time: "19:30" })).toBeNull();
  });
});

describe("isCancellable", () => {
  it("rejects already-cancelled signups", () => {
    const s = makeSignup("2099-01-01", "10:00", { cancelled_at: 1_700_000_000_000 });
    expect(isCancellable(s)).toBe(false);
  });

  it("rejects signups whose class object is missing", () => {
    const s: YogoSignup = { id: 1, class: 42 }; // class as a bare id, not populated
    expect(isCancellable(s)).toBe(false);
  });

  it("rejects classes starting in <15min (cutoff)", () => {
    const now = new Date("2026-05-26T19:00:00");
    const s = makeSignup("2026-05-26", "19:10", {});
    expect(isCancellable(s, now)).toBe(false);
  });

  it("accepts classes starting exactly past the 15-min cutoff", () => {
    const now = new Date("2026-05-26T19:00:00");
    const s = makeSignup("2026-05-26", "19:16", {});
    expect(isCancellable(s, now)).toBe(true);
  });

  it("accepts classes well in the future", () => {
    const now = new Date("2026-05-26T10:00:00");
    const s = makeSignup("2026-05-26", "19:30", {});
    expect(isCancellable(s, now)).toBe(true);
  });

  it("rejects classes in the past", () => {
    const now = new Date("2026-05-26T20:00:00");
    const s = makeSignup("2026-05-26", "19:00", {});
    expect(isCancellable(s, now)).toBe(false);
  });
});
