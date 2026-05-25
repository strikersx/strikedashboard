import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

function createPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required. Set it in .env.local (file:./dev.db for local sqlite, libsql://… for Turso).");
  }
  const adapter = new PrismaLibSql({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.__prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.__prisma = db;
