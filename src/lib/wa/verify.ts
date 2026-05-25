import { createHmac, timingSafeEqual } from "node:crypto";

const HEADER_PREFIX = "sha256=";

export function verifySignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader || !appSecret) return false;
  if (!signatureHeader.startsWith(HEADER_PREFIX)) return false;

  const provided = signatureHeader.slice(HEADER_PREFIX.length);
  if (!/^[a-f0-9]+$/i.test(provided) || provided.length % 2 !== 0) return false;

  const expectedHex = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  if (provided.length !== expectedHex.length) return false;

  const providedBuf = Buffer.from(provided, "hex");
  const expectedBuf = Buffer.from(expectedHex, "hex");
  if (providedBuf.length !== expectedBuf.length) return false;

  return timingSafeEqual(providedBuf, expectedBuf);
}
