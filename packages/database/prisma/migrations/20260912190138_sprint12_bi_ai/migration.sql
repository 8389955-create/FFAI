-- CreateEnum
CREATE TYPE "AnalyticsGranularity" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "InsightStatus" AS ENUM ('ACTIVE', 'DISMISSED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "AnalyticsSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "granularity" "AnalyticsGranularity" NOT NULL DEFAULT 'DAILY',
    "metrics" JSONB NOT NULL,
    "generatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiInsight" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fingerprint" VARCHAR(220) NOT NULL,
    "type" VARCHAR(60) NOT NULL,
    "status" "InsightStatus" NOT NULL DEFAULT 'ACTIVE',
    "severity" "AlertSeverity" NOT NULL DEFAULT 'INFO',
    "title" VARCHAR(180) NOT NULL,
    "summary" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "generatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsSnapshot_organizationId_granularity_snapshotDate_idx" ON "AnalyticsSnapshot"("organizationId", "granularity", "snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsSnapshot_organizationId_snapshotDate_granularity_key" ON "AnalyticsSnapshot"("organizationId", "snapshotDate", "granularity");

-- CreateIndex
CREATE INDEX "AiInsight_organizationId_status_severity_generatedAt_idx" ON "AiInsight"("organizationId", "status", "severity", "generatedAt");

-- CreateIndex
CREATE INDEX "AiInsight_organizationId_type_idx" ON "AiInsight"("organizationId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "AiInsight_organizationId_fingerprint_key" ON "AiInsight"("organizationId", "fingerprint");

-- AddForeignKey
ALTER TABLE "AnalyticsSnapshot" ADD CONSTRAINT "AnalyticsSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsSnapshot" ADD CONSTRAINT "AnalyticsSnapshot_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiInsight" ADD CONSTRAINT "AiInsight_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiInsight" ADD CONSTRAINT "AiInsight_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
