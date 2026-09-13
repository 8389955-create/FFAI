CREATE TYPE "ProductSyncStatus" AS ENUM ('NOT_SYNCED', 'BLOCKED', 'QUEUED', 'SYNCING', 'SYNCED', 'FAILED');

ALTER TABLE "Product" ADD COLUMN "sourceTemplateId" TEXT;

CREATE TABLE "ProductTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "categoryCode" VARCHAR(50) NOT NULL,
    "categoryName" VARCHAR(100) NOT NULL,
    "productType" "ProductType" NOT NULL DEFAULT 'FINISHED_GOOD',
    "summary" VARCHAR(500) NOT NULL,
    "defaults" JSONB NOT NULL,
    "skuBlueprints" JSONB NOT NULL,
    "channelMappings" JSONB NOT NULL,
    "assetChecklist" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductChannelListing" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "status" "ProductSyncStatus" NOT NULL DEFAULT 'NOT_SYNCED',
    "externalProductId" VARCHAR(160),
    "payload" JSONB,
    "payloadChecksum" VARCHAR(64),
    "requestedById" TEXT,
    "requestedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductChannelListing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductTemplate_organizationId_code_key" ON "ProductTemplate"("organizationId", "code");
CREATE INDEX "ProductTemplate_organizationId_active_categoryCode_idx" ON "ProductTemplate"("organizationId", "active", "categoryCode");
CREATE INDEX "Product_sourceTemplateId_idx" ON "Product"("sourceTemplateId");
CREATE UNIQUE INDEX "ProductChannelListing_productId_channelId_key" ON "ProductChannelListing"("productId", "channelId");
CREATE INDEX "ProductChannelListing_organizationId_status_updatedAt_idx" ON "ProductChannelListing"("organizationId", "status", "updatedAt");
CREATE INDEX "ProductChannelListing_channelId_status_idx" ON "ProductChannelListing"("channelId", "status");

ALTER TABLE "Product" ADD CONSTRAINT "Product_sourceTemplateId_fkey" FOREIGN KEY ("sourceTemplateId") REFERENCES "ProductTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductTemplate" ADD CONSTRAINT "ProductTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductTemplate" ADD CONSTRAINT "ProductTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductChannelListing" ADD CONSTRAINT "ProductChannelListing_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductChannelListing" ADD CONSTRAINT "ProductChannelListing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductChannelListing" ADD CONSTRAINT "ProductChannelListing_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "IntegrationChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductChannelListing" ADD CONSTRAINT "ProductChannelListing_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
