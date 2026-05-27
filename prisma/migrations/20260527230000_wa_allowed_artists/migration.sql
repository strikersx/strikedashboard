-- CreateTable
CREATE TABLE IF NOT EXISTS "WaAllowedArtist" (
    "spotifyArtistId" TEXT NOT NULL PRIMARY KEY,
    "artistName" TEXT NOT NULL,
    "reason" TEXT,
    "addedBy" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
