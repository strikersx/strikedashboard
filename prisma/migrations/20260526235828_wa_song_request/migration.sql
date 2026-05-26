-- CreateTable
CREATE TABLE "WaSongRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "yogoClassId" INTEGER NOT NULL,
    "spotifyTrackId" TEXT NOT NULL,
    "spotifyTrackName" TEXT NOT NULL,
    "spotifyArtistName" TEXT NOT NULL,
    "spotifyTrackUri" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "rejectedReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "WaSongRequest_contactId_yogoClassId_idx" ON "WaSongRequest"("contactId", "yogoClassId");

-- CreateIndex
CREATE INDEX "WaSongRequest_yogoClassId_status_idx" ON "WaSongRequest"("yogoClassId", "status");
