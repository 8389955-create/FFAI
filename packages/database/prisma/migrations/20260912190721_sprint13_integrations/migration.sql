-- CreateEnum
CREATE TYPE "IntegrationChannelType" AS ENUM ('WEBSITE', 'WECHAT_MINI_PROGRAM', 'TAOBAO', 'WECOM', 'DESIGNER_PORTAL', 'DEALER_PORTAL');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ERROR');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED', 'DEAD');

-- CreateTable
CREATE TABLE "IntegrationChannel" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "IntegrationChannelType" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'INACTIVE',
    "config" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiClient" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "channelId" TEXT,
    "name" VARCHAR(120) NOT NULL,
    "clientKey" VARCHAR(80) NOT NULL,
    "secretHash" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookSubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "channelId" TEXT,
    "name" VARCHAR(120) NOT NULL,
    "url" VARCHAR(1000) NOT NULL,
    "eventTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "signingSecretEncrypted" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookOutbox" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" VARCHAR(80) NOT NULL,
    "eventType" VARCHAR(120) NOT NULL,
    "aggregateType" VARCHAR(80) NOT NULL,
    "aggregateId" VARCHAR(120) NOT NULL,
    "payload" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "outboxId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "responseStatus" INTEGER,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationChannel_organizationId_status_idx" ON "IntegrationChannel"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationChannel_organizationId_type_key" ON "IntegrationChannel"("organizationId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "ApiClient_clientKey_key" ON "ApiClient"("clientKey");

-- CreateIndex
CREATE INDEX "ApiClient_organizationId_active_idx" ON "ApiClient"("organizationId", "active");

-- CreateIndex
CREATE INDEX "ApiClient_organizationId_channelId_idx" ON "ApiClient"("organizationId", "channelId");

-- CreateIndex
CREATE INDEX "WebhookSubscription_organizationId_active_idx" ON "WebhookSubscription"("organizationId", "active");

-- CreateIndex
CREATE INDEX "WebhookSubscription_organizationId_channelId_idx" ON "WebhookSubscription"("organizationId", "channelId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookOutbox_eventId_key" ON "WebhookOutbox"("eventId");

-- CreateIndex
CREATE INDEX "WebhookOutbox_organizationId_eventType_createdAt_idx" ON "WebhookOutbox"("organizationId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookOutbox_organizationId_aggregateType_aggregateId_idx" ON "WebhookOutbox"("organizationId", "aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_status_nextAttemptAt_idx" ON "WebhookDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_subscriptionId_createdAt_idx" ON "WebhookDelivery"("subscriptionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookDelivery_outboxId_subscriptionId_key" ON "WebhookDelivery"("outboxId", "subscriptionId");

-- AddForeignKey
ALTER TABLE "IntegrationChannel" ADD CONSTRAINT "IntegrationChannel_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationChannel" ADD CONSTRAINT "IntegrationChannel_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiClient" ADD CONSTRAINT "ApiClient_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiClient" ADD CONSTRAINT "ApiClient_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "IntegrationChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiClient" ADD CONSTRAINT "ApiClient_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookSubscription" ADD CONSTRAINT "WebhookSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookSubscription" ADD CONSTRAINT "WebhookSubscription_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "IntegrationChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookSubscription" ADD CONSTRAINT "WebhookSubscription_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookOutbox" ADD CONSTRAINT "WebhookOutbox_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookOutbox" ADD CONSTRAINT "WebhookOutbox_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_outboxId_fkey" FOREIGN KEY ("outboxId") REFERENCES "WebhookOutbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "WebhookSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
