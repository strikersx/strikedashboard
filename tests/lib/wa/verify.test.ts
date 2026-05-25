import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { verifySignature } from "../../../src/lib/wa/verify";

const SECRET = "test_app_secret_abc123";
const BODY = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [{ id: "WABA_ID", changes: [{ value: { messages: [{ id: "wamid.1", from: "351912345678", text: { body: "olá" } }] }, field: "messages" }] }],
});

function sign(body: string, secret: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

describe("verifySignature", () => {
  it("accepts a correctly-signed Meta payload", () => {
    expect(verifySignature(BODY, sign(BODY, SECRET), SECRET)).toBe(true);
  });

  it("rejects when secret differs", () => {
    expect(verifySignature(BODY, sign(BODY, "wrong_secret"), SECRET)).toBe(false);
  });

  it("rejects when body differs (tampered request)", () => {
    const tampered = BODY.replace("olá", "tampered");
    expect(verifySignature(tampered, sign(BODY, SECRET), SECRET)).toBe(false);
  });

  it("rejects when header is missing", () => {
    expect(verifySignature(BODY, null, SECRET)).toBe(false);
  });

  it("rejects when header lacks sha256= prefix", () => {
    const naked = createHmac("sha256", SECRET).update(BODY).digest("hex");
    expect(verifySignature(BODY, naked, SECRET)).toBe(false);
  });

  it("rejects when secret is empty", () => {
    expect(verifySignature(BODY, sign(BODY, SECRET), "")).toBe(false);
  });

  it("rejects when header is the wrong length", () => {
    expect(verifySignature(BODY, "sha256=abc123", SECRET)).toBe(false);
  });

  it("rejects when header contains non-hex characters", () => {
    const validLen = "g".repeat(64);
    expect(verifySignature(BODY, "sha256=" + validLen, SECRET)).toBe(false);
  });

  it("rejects when header has odd hex length", () => {
    expect(verifySignature(BODY, "sha256=" + "a".repeat(63), SECRET)).toBe(false);
  });

  it("verifies empty body when correctly signed", () => {
    expect(verifySignature("", sign("", SECRET), SECRET)).toBe(true);
  });

  it("verifies UTF-8 multibyte body correctly", () => {
    const utf8Body = JSON.stringify({ text: "olá á é í ó ú ç 🥋" });
    expect(verifySignature(utf8Body, sign(utf8Body, SECRET), SECRET)).toBe(true);
  });
});
