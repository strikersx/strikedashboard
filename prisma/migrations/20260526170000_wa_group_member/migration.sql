-- CreateTable
CREATE TABLE "WaGroupMember" (
    "phoneE164" TEXT NOT NULL PRIMARY KEY,
    "savedName" TEXT,
    "publicName" TEXT,
    "groupName" TEXT,
    "isMyContact" BOOLEAN NOT NULL DEFAULT false,
    "isBusiness" BOOLEAN NOT NULL DEFAULT false,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "labels" TEXT,
    "countryCode" TEXT,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
