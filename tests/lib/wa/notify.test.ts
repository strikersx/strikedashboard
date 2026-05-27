import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendTextMock = vi.hoisted(() => vi.fn());
const eventCreateMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/wa/meta", () => ({ sendText: sendTextMock }));
vi.mock("@/lib/db", () => ({ db: { waEvent: { create: eventCreateMock } } }));

import { notifyAdmin } from "../../../src/lib/wa/notify";

describe("notifyAdmin", () => {
  const ORIG_ENV = process.env.RICARDO_PHONE_E164;

  beforeEach(() => {
    sendTextMock.mockReset();
    eventCreateMock.mockReset();
    eventCreateMock.mockResolvedValue({});
  });

  afterEach(() => {
    if (ORIG_ENV === undefined) delete process.env.RICARDO_PHONE_E164;
    else process.env.RICARDO_PHONE_E164 = ORIG_ENV;
  });

  it("logs OOB_NOTIFY_FAIL when env is missing and does not call sendText", async () => {
    delete process.env.RICARDO_PHONE_E164;
    await notifyAdmin("hello", "TEST");
    expect(sendTextMock).not.toHaveBeenCalled();
    expect(eventCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: "OOB_NOTIFY_FAIL", phoneE164: null }),
    });
  });

  it("logs OOB_NOTIFY_OK and calls sendText when env set and Meta returns ok", async () => {
    process.env.RICARDO_PHONE_E164 = "+351912873698";
    sendTextMock.mockResolvedValue({ ok: true, status: 200, body: "{}" });
    await notifyAdmin("hello", "TEST");
    expect(sendTextMock).toHaveBeenCalledWith("+351912873698", "hello");
    expect(eventCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: "OOB_NOTIFY_OK", phoneE164: "+351912873698" }),
    });
  });

  it("logs OOB_NOTIFY_FAIL with status and body snippet when Meta returns non-ok", async () => {
    process.env.RICARDO_PHONE_E164 = "+351912873698";
    sendTextMock.mockResolvedValue({ ok: false, status: 400, body: "bad" });
    await notifyAdmin("hello", "TEST");
    expect(eventCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: "OOB_NOTIFY_FAIL", phoneE164: "+351912873698" }),
    });
    const args = eventCreateMock.mock.calls[0][0];
    expect(args.data.meta).toContain("\"status\":400");
  });

  it("swallows sendText throws and logs OOB_NOTIFY_FAIL", async () => {
    process.env.RICARDO_PHONE_E164 = "+351912873698";
    sendTextMock.mockRejectedValue(new Error("network down"));
    await expect(notifyAdmin("hello", "TEST")).resolves.toBeUndefined();
    expect(eventCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: "OOB_NOTIFY_FAIL" }),
    });
  });

  it("does not throw even if waEvent.create itself throws", async () => {
    process.env.RICARDO_PHONE_E164 = "+351912873698";
    sendTextMock.mockResolvedValue({ ok: true, status: 200, body: "{}" });
    eventCreateMock.mockRejectedValueOnce(new Error("db down"));
    await expect(notifyAdmin("hello", "TEST")).resolves.toBeUndefined();
  });
});
