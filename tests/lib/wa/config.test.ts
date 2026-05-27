import { afterEach, describe, expect, it } from "vitest";
import { INVITE_URL_FINGERPRINT_PROD, isOutboundEnabled, isWaEnabled, validateInviteUrl } from "../../../src/lib/wa/config";

const ORIGINAL = process.env.WA_ENABLED;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.WA_ENABLED;
  else process.env.WA_ENABLED = ORIGINAL;
});

describe("isWaEnabled", () => {
  it("defaults to true when env is unset", () => {
    delete process.env.WA_ENABLED;
    expect(isWaEnabled()).toBe(true);
  });

  it("returns true for 'true'", () => {
    process.env.WA_ENABLED = "true";
    expect(isWaEnabled()).toBe(true);
  });

  it("returns false only for the literal 'false'", () => {
    process.env.WA_ENABLED = "false";
    expect(isWaEnabled()).toBe(false);
  });

  it("treats any other value as enabled (kill switch is opt-in)", () => {
    process.env.WA_ENABLED = "0";
    expect(isWaEnabled()).toBe(true);
    process.env.WA_ENABLED = "off";
    expect(isWaEnabled()).toBe(true);
    process.env.WA_ENABLED = "";
    expect(isWaEnabled()).toBe(true);
  });

  it("is case-sensitive: 'False' counts as enabled", () => {
    process.env.WA_ENABLED = "False";
    expect(isWaEnabled()).toBe(true);
  });
});

describe("isOutboundEnabled", () => {
  const origEnv = process.env.WA_OUTBOUND_ENABLED;
  afterEach(() => { process.env.WA_OUTBOUND_ENABLED = origEnv; });

  it("returns true only when env is the exact string \"true\"", () => {
    process.env.WA_OUTBOUND_ENABLED = "true";
    expect(isOutboundEnabled()).toBe(true);
  });

  it("returns false when unset", () => {
    delete process.env.WA_OUTBOUND_ENABLED;
    expect(isOutboundEnabled()).toBe(false);
  });

  it.each(["false", "True", "TRUE", " true", "1", "", "yes"])(
    "returns false for %s (loose values are not honoured)",
    (v) => {
      process.env.WA_OUTBOUND_ENABLED = v;
      expect(isOutboundEnabled()).toBe(false);
    },
  );
});

describe("validateInviteUrl", () => {
  const FP = "AbCdEf";

  it("accepts a valid URL with fingerprint", () => {
    expect(validateInviteUrl("https://chat.whatsapp.com/XYZ1AbCdEfABCDEFGHIJ", FP)).toEqual({ ok: true });
  });

  it("accepts a URL with tracking query string", () => {
    expect(validateInviteUrl("https://chat.whatsapp.com/XYZAbCdEf12345ABCDEF?s=sw&p=a&mlu=4", FP)).toEqual({ ok: true });
  });

  it("rejects http (non-TLS)", () => {
    expect(validateInviteUrl("http://chat.whatsapp.com/XYZAbCdEf12345ABCDEF", FP)).toEqual({ ok: false, reason: "shape" });
  });

  it("rejects unrelated domain", () => {
    expect(validateInviteUrl("https://telegram.me/AbCdEfABCDEFGHIJABCD", FP)).toEqual({ ok: false, reason: "shape" });
  });

  it("rejects empty string", () => {
    expect(validateInviteUrl("", FP)).toEqual({ ok: false, reason: "shape" });
  });

  it("rejects undefined", () => {
    expect(validateInviteUrl(undefined, FP)).toEqual({ ok: false, reason: "shape" });
  });

  it("rejects a valid shape that doesn't carry the fingerprint", () => {
    expect(validateInviteUrl("https://chat.whatsapp.com/ABCDEFGHIJKLMNOPQRST", FP)).toEqual({ ok: false, reason: "fingerprint" });
  });

  it("exports the prod fingerprint constant", () => {
    expect(typeof INVITE_URL_FINGERPRINT_PROD).toBe("string");
  });
});
