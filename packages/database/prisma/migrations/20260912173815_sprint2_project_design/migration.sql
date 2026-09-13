-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('INQUIRY', 'MEASURING', 'DESIGNING', 'QUOTING', 'CUSTOMER_REVIEW', 'CONFIRMED', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProjectMemberRole" AS ENUM ('MANAGER', 'SALES', 'DESIGNER', 'COLLABORATOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "DesignStatus" AS ENUM ('DRAFT', 'INTERNAL_REVIEW', 'CUSTOMER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectNo" VARCHAR(50) NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'INQUIRY',
    "address" VARCHAR(500),
    "estimatedBudget" DECIMAL(14,2),
    "expectedDeliveryAt" TIMESTAMP(3),
    "ownerId" TEXT NOT NULL,
    "orgUnitId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProjectMemberRole" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("projectId","userId")
);

-- CreateTable
CREATE TABLE "ProjectSpace" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "roomType" VARCHAR(60),
    "floor" VARCHAR(30),
    "lengthMm" INTEGER,
    "widthMm" INTEGER,
    "heightMm" INTEGER,
    "areaSqm" DECIMAL(10,2),
    "notes" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSpace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignVersion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "status" "DesignStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "attachmentId" TEXT,
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_organizationId_ownerId_status_idx" ON "Project"("organizationId", "ownerId", "status");

-- CreateIndex
CREATE INDEX "Project_organizationId_orgUnitId_idx" ON "Project"("organizationId", "orgUnitId");

-- CreateIndex
CREATE INDEX "Project_organizationId_customerId_idx" ON "Project"("organizationId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_organizationId_projectNo_key" ON "Project"("organizationId", "projectNo");

-- CreateIndex
CREATE INDEX "ProjectMember_userId_role_idx" ON "ProjectMember"("userId", "role");

-- CreateIndex
CREATE INDEX "ProjectSpace_projectId_sort_idx" ON "ProjectSpace"("projectId", "sort");

-- CreateIndex
CREATE INDEX "DesignVersion_projectId_status_idx" ON "DesignVersion"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DesignVersion_projectId_versionNo_key" ON "DesignVersion"("projectId", "versionNo");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSpace" ADD CONSTRAINT "ProjectSpace_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignVersion" ADD CONSTRAINT "DesignVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignVersion" ADD CONSTRAINT "DesignVersion_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignVersion" ADD CONSTRAINT "DesignVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignVersion" ADD CONSTRAINT "DesignVersion_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
