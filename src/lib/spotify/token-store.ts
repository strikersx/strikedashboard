import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("SPOTIFY_TOKEN_ENCRYPTION_KEY not set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("SPOTIFY_TOKEN_ENCRYPTION_KEY must be 32 bytes base64");
  return key;
}

export interface EncryptedToken {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export function encryptToken(plaintext: string): EncryptedToken {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: ct.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptToken(e: EncryptedToken): string {
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(e.iv, "base64"));
  decipher.setAuthTag(Buffer.from(e.authTag, "base64"));
  const pt = Buffer.concat([decipher.update(Buffer.from(e.ciphertext, "base64")), decipher.final()]);
  return pt.toString("utf8");
}

export async function saveRefreshToken(
  refreshToken: string,
  spotifyUserId: string,
  scope: string
): Promise<void> {
  const enc = encryptToken(refreshToken);
  await db.spotifyToken.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...enc, spotifyUserId, scope },
    update: { ...enc, spotifyUserId, scope },
  });
}

export async function loadRefreshToken(): Promise<{ refreshToken: string; spotifyUserId: string } | null> {
  const row = await db.spotifyToken.findUnique({ where: { id: "singleton" } });
  if (!row) return null;
  return {
    refreshToken: decryptToken({ ciphertext: row.ciphertext, iv: row.iv, authTag: row.authTag }),
    spotifyUserId: row.spotifyUserId,
  };
}
