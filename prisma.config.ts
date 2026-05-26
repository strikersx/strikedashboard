import "dotenv/config";
import { defineConfig } from "prisma/config";

// Only used by `prisma generate` and (limited) `prisma migrate dev` against
// a local sqlite file. For Turso migrations, use scripts/migrate-turso.mjs --
// Prisma 7's CLI doesn't yet honour migrate.adapter for libsql.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: "file:./prisma/dev.db",
  },
});
