import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

config({ path: ".env.local" });

// Artists that look blocked by keyword filter but are actually fine for class.
// Example: "Poesia Acústica" matches the "acústico"/"acoustic" keyword via
// substring on the artist name — but it's a Brazilian trap cypher series with
// solid energy. Allowlisting skips the keyword filter (explicit + blocklist
// still apply).
//
// To find a Spotify artist ID:
//   curl -H "Authorization: Bearer $TOKEN" \
//     "https://api.spotify.com/v1/search?q=poesia%20acustica&type=artist&limit=5"
const SEED_ALLOWED: Array<{
  spotifyArtistId: string;
  artistName: string;
  reason: string;
}> = [
  // {
  //   spotifyArtistId: "<paste-real-id-here>",
  //   artistName: "Poesia Acústica",
  //   reason: "Brazilian trap cypher — false positive on 'acústico' keyword",
  // },
];

async function main() {
  if (SEED_ALLOWED.length === 0) {
    console.log("No allowlist seed entries — add Spotify IDs to SEED_ALLOWED.");
    return;
  }
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  const adapter = new PrismaLibSql({ url, authToken });
  const db = new PrismaClient({ adapter });
  for (const a of SEED_ALLOWED) {
    await db.waAllowedArtist.upsert({
      where: { spotifyArtistId: a.spotifyArtistId },
      create: { ...a, addedBy: "system-seed" },
      update: {},
    });
  }
  console.log(`Seeded ${SEED_ALLOWED.length} allowed artists.`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
