-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('INDIVIDUAL', 'COMPANY', 'DEALER', 'DESIGNER');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('PROSPECT', 'ACTIVE', 'INACTIVE', 'BLACKLISTED');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFYING', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CALL', 'MESSAGE', 'VISIT', 'MEETING', 'NOTE');

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerNo" VARCHAR(50) NOT NULL,
    "type" "CustomerType" NOT NULL DEFAULT 'INDIVIDUAL',
    "status" "CustomerStatus" NOT NULL DEFAULT 'PROSPECT',
    "name" VARCHAR(150) NOT NULL,
    "shortName" VARCHAR(100),
    "phone" VARCHAR(30),
    "email" VARCHAR(255),
    "source" VARCHAR(80),
    "level" VARCHAR(30),
    "province" VARCHAR(50),
    "city" VARCHAR(50),
    "address" VARCHAR(500),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "ownerId" TEXT NOT NULL,
    "orgUnitId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerContact" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "title" VARCHAR(80),
    "phone" VARCHAR(30),
    "email" VARCHAR(255),
    "wechat" VARCHAR(100),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadNo" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "contactName" VARCHAR(100),
    "phone" VARCHAR(30),
    "email" VARCHAR(255),
    "source" VARCHAR(80),
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "intentSummary" TEXT,
    "estimatedValue" DECIMAL(14,2),
    "nextFollowUpAt" TIMESTAMP(3),
    "lostReason" TEXT,
    "ownerId" TEXT NOT NULL,
    "orgUnitId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "convertedCustomerId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmActivity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT,
    "leadId" TEXT,
    "type" "ActivityType" NOT NULL,
    "content" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextFollowUpAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_organizationId_ownerId_status_idx" ON "Customer"("organizationId", "ownerId", "status");

-- CreateIndex
CREATE INDEX "Customer_organizationId_orgUnitId_idx" ON "Customer"("organizationId", "orgUnitId");

-- CreateIndex
CREATE INDEX "Customer_organizationId_name_idx" ON "Customer"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_organizationId_customerNo_key" ON "Customer"("organizationId", "customerNo");

-- CreateIndex
CREATE INDEX "CustomerContact_customerId_isPrimary_idx" ON "CustomerContact"("customerId", "isPrimary");

-- CreateIndex
CREATE INDEX "Lead_organizationId_ownerId_status_idx" ON "Lead"("organizationId", "ownerId", "status");

-- CreateIndex
CREATE INDEX "Lead_organizationId_orgUnitId_idx" ON "Lead"("organizationId", "orgUnitId");

-- CreateIndex
CREATE INDEX "Lead_organizationId_nextFollowUpAt_idx" ON "Lead"("organizationId", "nextFollowUpAt");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_organizationId_leadNo_key" ON "Lead"("organizationId", "leadNo");

-- CreateIndex
CREATE INDEX "CrmActivity_organizationId_customerId_occurredAt_idx" ON "CrmActivity"("organizationId", "customerId", "occurredAt");

-- CreateIndex
CREATE INDEX "CrmActivity_organizationId_leadId_occurredAt_idx" ON "CrmActivity"("organizationId", "leadId", "occurredAt");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerContact" ADD CONSTRAINT "CustomerContact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedCustomerId_fkey" FOREIGN KEY ("convertedCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
