import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// Load .env.local for local dev
config({ path: ".env.local" });

// Each keyword is matched ONLY against its field — "genre" against Spotify genres,
// "artist" against artist names, "track" against the track title. Field-scoping
// avoids cross-field false positives (e.g. "adele" leaking into "Madeleine").
type Field = "genre" | "artist" | "track";

const GENRE_KEYWORDS = [
  // Brazilian
  "funk carioca", "funk ostentação", "funk mtg", "funk 150",
  "funk melody", "brega funk", "funk consciente",
  "funk putaria", "porn funk", "mandelão",
  "pagode", "samba pagode",
  "axé", "axe music",
  "forró eletrônico", "forro eletronico", "forró pé de serra", "forró",
  "sertanejo universitário", "sertanejo romântico", "modão", "sofrência",
  "pisadinha", "brega",

  // Portuguese / Lusophone
  "pimba", "kizomba", "tarraxinha", "semba", "fado", "fadista", "morna",
  "portuguese hip hop", "rap português", "trap português",

  // Latin (não-cardio)
  "reggaeton", "bachata", "salsa", "cumbia",

  // chill / sleep / kids
  "bossa nova", "smooth jazz", "mpb lenta",
  "lo-fi", "chillhop", "chillwave", "new age", "yoga music",
  "sound healing", "ambient", "ambient sleep", "sleep", "meditation",
  "lullaby", "children's music", "kids music", "infantil", "disney",
  "karaoke", "karaokê",
  "worship", "christian worship",

  // Subgenres
  "sad rap",
];

const ARTIST_KEYWORDS = [
  "anitta", "ludmilla", "marília mendonça", "gusttavo lima",
  "ed sheeran", "adele", "shawn mendes",
  "mariza", "camané", "antónio zambujo",
  "nelson freitas", "anselmo ralph", "yuri da cunha",
  "dillaz", "bispo", "prodigio", "piruka", "slow j",
];

const TRACK_KEYWORDS = [
  "putaria", "desabafo",
  "remix lento", "versão acústica", "acústico", "acoustic",
];

const SEED_KEYWORDS: Array<{ keyword: string; field: Field }> = [
  ...GENRE_KEYWORDS.map((keyword) => ({ keyword, field: "genre" as Field })),
  ...ARTIST_KEYWORDS.map((keyword) => ({ keyword, field: "artist" as Field })),
  ...TRACK_KEYWORDS.map((keyword) => ({ keyword, field: "track" as Field })),
];

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  const adapter = new PrismaLibSql({ url, authToken });
  const db = new PrismaClient({ adapter });
  for (const { keyword, field } of SEED_KEYWORDS) {
    await db.waBlockedGenre.upsert({
      where: { keyword },
      create: { keyword, field, addedBy: "system-seed" },
      update: { field },
    });
  }
  console.log(`Seeded ${SEED_KEYWORDS.length} blocked genres.`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
