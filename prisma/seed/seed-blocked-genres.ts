import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// Load .env.local for local dev
config({ path: ".env.local" });

const SEED_KEYWORDS = [
  // Genres — Brazilian
  "funk carioca", "funk ostentação", "funk mtg", "funk 150",
  "funk melody", "brega funk", "funk consciente",
  "funk putaria", "porn funk", "mandelão",
  "pagode", "samba pagode",
  "axé", "axe music",
  "forró eletrônico", "forro eletronico", "forró pé de serra", "forró",
  "sertanejo universitário", "sertanejo romântico", "modão", "sofrência",
  "pisadinha", "brega",

  // Genres — Portuguese / Lusophone
  "pimba", "kizomba", "tarraxinha", "semba", "fado", "fadista", "morna",
  "portuguese hip hop", "rap português", "trap português",

  // Genres — Latin (não-cardio)
  "reggaeton", "bachata", "salsa", "cumbia",

  // Genres — chill / sleep / kids
  "bossa nova", "smooth jazz", "mpb lenta",
  "lo-fi", "chillhop", "chillwave", "new age", "yoga music",
  "sound healing", "ambient", "ambient sleep", "sleep", "meditation",
  "lullaby", "children's music", "kids music", "infantil", "disney",
  "karaoke", "karaokê",
  "worship", "christian worship",

  // Artist names (matched against artist.name)
  "anitta", "ludmilla", "marília mendonça", "gusttavo lima",
  "ed sheeran", "adele", "shawn mendes",
  "mariza", "camané", "antónio zambujo",
  "nelson freitas", "anselmo ralph", "yuri da cunha",
  "dillaz", "bispo", "prodigio", "piruka", "slow j",

  // Track-name keywords (matched against track.name)
  "putaria", "desabafo",
  "remix lento", "versão acústica", "acústico",
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
