-- CreateTable
CREATE TABLE "WaContact" (
    "phoneE164" TEXT NOT NULL PRIMARY KEY,
    "yogoCustomerId" INTEGER,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WaInbound" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "metaId" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WaInbound_phoneE164_fkey" FOREIGN KEY ("phoneE164") REFERENCES "WaContact" ("phoneE164") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WaSession" (
    "phoneE164" TEXT NOT NULL PRIMARY KEY,
    "state" TEXT NOT NULL DEFAULT 'IDLE',
    "pendingClassId" INTEGER,
    "pendingSignupId" INTEGER,
    "expiresAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WaSession_phoneE164_fkey" FOREIGN KEY ("phoneE164") REFERENCES "WaContact" ("phoneE164") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WaOutbound" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phoneE164" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "templateKey" TEXT,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WaOutbound_phoneE164_fkey" FOREIGN KEY ("phoneE164") REFERENCES "WaContact" ("phoneE164") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WaEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "phoneE164" TEXT,
    "meta" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "WaInbound_metaId_key" ON "WaInbound"("metaId");

-- CreateIndex
CREATE INDEX "WaInbound_phoneE164_receivedAt_idx" ON "WaInbound"("phoneE164", "receivedAt");

-- CreateIndex
CREATE INDEX "WaOutbound_phoneE164_sentAt_idx" ON "WaOutbound"("phoneE164", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "WaOutbound_phoneE164_templateKey_key" ON "WaOutbound"("phoneE164", "templateKey");

-- CreateIndex
CREATE INDEX "WaEvent_kind_createdAt_idx" ON "WaEvent"("kind", "createdAt");
