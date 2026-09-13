-- CreateEnum
CREATE TYPE "ProductionOrderStatus" AS ENUM ('PLANNED', 'RELEASED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('PENDING', 'READY', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkReportType" AS ENUM ('START', 'PROGRESS', 'COMPLETE', 'ISSUE');

-- CreateTable
CREATE TABLE "ProductionOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productionOrderNo" VARCHAR(60) NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "status" "ProductionOrderStatus" NOT NULL DEFAULT 'PLANNED',
    "priority" INTEGER NOT NULL DEFAULT 50,
    "plannedStartAt" TIMESTAMP(3),
    "plannedEndAt" TIMESTAMP(3),
    "actualStartAt" TIMESTAMP(3),
    "actualEndAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOrderItem" (
    "id" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "salesOrderItemId" TEXT NOT NULL,
    "productId" TEXT,
    "skuId" TEXT,
    "description" VARCHAR(300) NOT NULL,
    "specification" VARCHAR(300),
    "plannedQuantity" DECIMAL(12,3) NOT NULL,
    "completedQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "unit" VARCHAR(30) NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workOrderNo" VARCHAR(70) NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "productionOrderItemId" TEXT NOT NULL,
    "operationCode" VARCHAR(50) NOT NULL,
    "operationName" VARCHAR(100) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'PENDING',
    "workstation" VARCHAR(100),
    "assignedToId" TEXT,
    "plannedQuantity" DECIMAL(12,3) NOT NULL,
    "completedQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "scrapQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "plannedStartAt" TIMESTAMP(3),
    "plannedEndAt" TIMESTAMP(3),
    "actualStartAt" TIMESTAMP(3),
    "actualEndAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkReport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "type" "WorkReportType" NOT NULL,
    "goodQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "scrapQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "minutesSpent" INTEGER,
    "note" TEXT,
    "reporterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOrder_salesOrderId_key" ON "ProductionOrder"("salesOrderId");

-- CreateIndex
CREATE INDEX "ProductionOrder_organizationId_status_priority_idx" ON "ProductionOrder"("organizationId", "status", "priority");

-- CreateIndex
CREATE INDEX "ProductionOrder_organizationId_plannedEndAt_idx" ON "ProductionOrder"("organizationId", "plannedEndAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOrder_organizationId_productionOrderNo_key" ON "ProductionOrder"("organizationId", "productionOrderNo");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOrderItem_salesOrderItemId_key" ON "ProductionOrderItem"("salesOrderItemId");

-- CreateIndex
CREATE INDEX "ProductionOrderItem_productionOrderId_sort_idx" ON "ProductionOrderItem"("productionOrderId", "sort");

-- CreateIndex
CREATE INDEX "ProductionOrderItem_productId_idx" ON "ProductionOrderItem"("productId");

-- CreateIndex
CREATE INDEX "ProductionOrderItem_skuId_idx" ON "ProductionOrderItem"("skuId");

-- CreateIndex
CREATE INDEX "WorkOrder_organizationId_assignedToId_status_idx" ON "WorkOrder"("organizationId", "assignedToId", "status");

-- CreateIndex
CREATE INDEX "WorkOrder_productionOrderId_sequence_idx" ON "WorkOrder"("productionOrderId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_organizationId_workOrderNo_key" ON "WorkOrder"("organizationId", "workOrderNo");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_productionOrderItemId_sequence_key" ON "WorkOrder"("productionOrderItemId", "sequence");

-- CreateIndex
CREATE INDEX "WorkReport_organizationId_workOrderId_createdAt_idx" ON "WorkReport"("organizationId", "workOrderId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkReport_organizationId_reporterId_createdAt_idx" ON "WorkReport"("organizationId", "reporterId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrderItem" ADD CONSTRAINT "ProductionOrderItem_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrderItem" ADD CONSTRAINT "ProductionOrderItem_salesOrderItemId_fkey" FOREIGN KEY ("salesOrderItemId") REFERENCES "SalesOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrderItem" ADD CONSTRAINT "ProductionOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrderItem" ADD CONSTRAINT "ProductionOrderItem_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "ProductSku"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_productionOrderItemId_fkey" FOREIGN KEY ("productionOrderItemId") REFERENCES "ProductionOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkReport" ADD CONSTRAINT "WorkReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkReport" ADD CONSTRAINT "WorkReport_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkReport" ADD CONSTRAINT "WorkReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
