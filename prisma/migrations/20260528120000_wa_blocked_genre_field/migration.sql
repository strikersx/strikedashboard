-- AlterTable: scope each blocked keyword to the Spotify field it matches against.
-- Existing rows default to "genre"; artist- and track-name keywords are back-filled below.
ALTER TABLE "WaBlockedGenre" ADD COLUMN "field" TEXT NOT NULL DEFAULT 'genre';

-- Back-fill artist-name keywords
UPDATE "WaBlockedGenre" SET "field" = 'artist' WHERE "keyword" IN (
  'anitta', 'ludmilla', 'marília mendonça', 'gusttavo lima',
  'ed sheeran', 'adele', 'shawn mendes',
  'mariza', 'camané', 'antónio zambujo',
  'nelson freitas', 'anselmo ralph', 'yuri da cunha',
  'dillaz', 'bispo', 'prodigio', 'piruka', 'slow j'
);

-- Back-fill track-name keywords
UPDATE "WaBlockedGenre" SET "field" = 'track' WHERE "keyword" IN (
  'putaria', 'desabafo',
  'remix lento', 'versão acústica', 'acústico', 'acoustic'
);
