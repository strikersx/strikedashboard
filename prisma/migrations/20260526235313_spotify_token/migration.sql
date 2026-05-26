-- CreateTable
CREATE TABLE "SpotifyToken" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "ciphertext" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "spotifyUserId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
