-- CreateTable
CREATE TABLE "WaClassPlaylist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "yogoClassId" INTEGER NOT NULL,
    "spotifyPlaylistId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "locked" BOOLEAN NOT NULL DEFAULT false
);

-- CreateIndex
CREATE UNIQUE INDEX "WaClassPlaylist_yogoClassId_key" ON "WaClassPlaylist"("yogoClassId");
