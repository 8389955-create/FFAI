-- CreateEnum
CREATE TYPE "WorkTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkTaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "WorkTask" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taskNo" VARCHAR(70) NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "status" "WorkTaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "WorkTaskPriority" NOT NULL DEFAULT 'NORMAL',
    "dueAt" TIMESTAMP(3),
    "reminderAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "sourceType" VARCHAR(60),
    "sourceId" VARCHAR(100),
    "sourceNo" VARCHAR(100),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assigneeId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fingerprint" VARCHAR(220) NOT NULL,
    "category" VARCHAR(60) NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'WARNING',
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "title" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "sourceType" VARCHAR(60),
    "sourceId" VARCHAR(100),
    "sourceNo" VARCHAR(100),
    "dueAt" TIMESTAMP(3),
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "acknowledgedById" TEXT,
    "resolvedById" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkTask_organizationId_assigneeId_status_dueAt_idx" ON "WorkTask"("organizationId", "assigneeId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "WorkTask_organizationId_sourceType_sourceId_idx" ON "WorkTask"("organizationId", "sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkTask_organizationId_taskNo_key" ON "WorkTask"("organizationId", "taskNo");

-- CreateIndex
CREATE INDEX "AlertEvent_organizationId_status_severity_detectedAt_idx" ON "AlertEvent"("organizationId", "status", "severity", "detectedAt");

-- CreateIndex
CREATE INDEX "AlertEvent_organizationId_category_sourceType_idx" ON "AlertEvent"("organizationId", "category", "sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "AlertEvent_organizationId_fingerprint_key" ON "AlertEvent"("organizationId", "fingerprint");

-- AddForeignKey
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
