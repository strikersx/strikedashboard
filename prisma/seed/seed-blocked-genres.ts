import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// Load .env.local for local dev
config({ path: ".env.local" });

const SEED_KEYWORDS = [
  "funk carioca", "funk ostentação", "funk mtg", "funk 150",
  "funk melody", "brega funk", "funk consciente",
  "pagode", "samba pagode",
  "axé", "axe music",
  "forró eletrônico", "forro eletronico", "forró pé de serra",
  "sertanejo universitário", "sertanejo romântico", "modão",
  "pisadinha", "brega",
  "pimba", "kizomba", "tarraxinha", "fado", "morna",
  "bossa nova", "smooth jazz",
  "lullaby", "children's music", "kids music",
  "meditation", "sleep", "ambient sleep",
  "karaoke", "worship", "christian worship",
];

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  const adapter = new PrismaLibSql({ url, authToken });
  const db = new PrismaClient({ adapter });
  for (const kw of SEED_KEYWORDS) {
    await db.waBlockedGenre.upsert({
      where: { keyword: kw },
      create: { keyword: kw, addedBy: "system-seed" },
      update: {},
    });
  }
  console.log(`Seeded ${SEED_KEYWORDS.length} blocked genres.`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
