-- CreateTable
CREATE TABLE "WaBlockedGenre" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keyword" TEXT NOT NULL,
    "addedBy" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "WaBlockedArtist" (
    "spotifyArtistId" TEXT NOT NULL PRIMARY KEY,
    "artistName" TEXT NOT NULL,
    "reason" TEXT,
    "addedBy" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "WaBlockedGenre_keyword_key" ON "WaBlockedGenre"("keyword");
