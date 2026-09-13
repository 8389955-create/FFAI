-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('DRAFT', 'READY', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InstallationStatus" AS ENUM ('PENDING', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AfterSalesType" AS ENUM ('DAMAGE', 'QUALITY', 'INSTALLATION', 'REPAIR', 'RETURN', 'EXCHANGE', 'OTHER');

-- CreateEnum
CREATE TYPE "AfterSalesStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AfterSalesPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "shipmentNo" VARCHAR(70) NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'DRAFT',
    "carrier" VARCHAR(120),
    "trackingNo" VARCHAR(120),
    "vehicleNo" VARCHAR(50),
    "driverName" VARCHAR(100),
    "driverPhone" VARCHAR(30),
    "deliveryAddress" VARCHAR(500) NOT NULL,
    "contactName" VARCHAR(100),
    "contactPhone" VARCHAR(30),
    "scheduledAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "signedBy" VARCHAR(100),
    "proofAttachmentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "assignedToId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentItem" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "salesOrderItemId" TEXT NOT NULL,
    "stockLocationId" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "deliveredQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "stockIssuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShipmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstallationTask" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "installationNo" VARCHAR(70) NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "status" "InstallationStatus" NOT NULL DEFAULT 'PENDING',
    "address" VARCHAR(500) NOT NULL,
    "contactName" VARCHAR(100),
    "contactPhone" VARCHAR(30),
    "scheduledStartAt" TIMESTAMP(3),
    "scheduledEndAt" TIMESTAMP(3),
    "actualStartAt" TIMESTAMP(3),
    "actualEndAt" TIMESTAMP(3),
    "completionNote" TEXT,
    "proofAttachmentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "assignedToId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstallationTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AfterSalesTicket" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ticketNo" VARCHAR(70) NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "AfterSalesType" NOT NULL,
    "status" "AfterSalesStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "AfterSalesPriority" NOT NULL DEFAULT 'NORMAL',
    "title" VARCHAR(180) NOT NULL,
    "description" TEXT NOT NULL,
    "resolution" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "attachmentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assignedToId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AfterSalesTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AfterSalesComment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AfterSalesComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Shipment_organizationId_status_scheduledAt_idx" ON "Shipment"("organizationId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Shipment_organizationId_salesOrderId_idx" ON "Shipment"("organizationId", "salesOrderId");

-- CreateIndex
CREATE INDEX "Shipment_organizationId_assignedToId_status_idx" ON "Shipment"("organizationId", "assignedToId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_organizationId_shipmentNo_key" ON "Shipment"("organizationId", "shipmentNo");

-- CreateIndex
CREATE INDEX "ShipmentItem_salesOrderItemId_idx" ON "ShipmentItem"("salesOrderItemId");

-- CreateIndex
CREATE INDEX "ShipmentItem_stockLocationId_idx" ON "ShipmentItem"("stockLocationId");

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentItem_shipmentId_salesOrderItemId_key" ON "ShipmentItem"("shipmentId", "salesOrderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "InstallationTask_shipmentId_key" ON "InstallationTask"("shipmentId");

-- CreateIndex
CREATE INDEX "InstallationTask_organizationId_status_scheduledStartAt_idx" ON "InstallationTask"("organizationId", "status", "scheduledStartAt");

-- CreateIndex
CREATE INDEX "InstallationTask_organizationId_salesOrderId_idx" ON "InstallationTask"("organizationId", "salesOrderId");

-- CreateIndex
CREATE INDEX "InstallationTask_organizationId_assignedToId_status_idx" ON "InstallationTask"("organizationId", "assignedToId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InstallationTask_organizationId_installationNo_key" ON "InstallationTask"("organizationId", "installationNo");

-- CreateIndex
CREATE INDEX "AfterSalesTicket_organizationId_status_priority_idx" ON "AfterSalesTicket"("organizationId", "status", "priority");

-- CreateIndex
CREATE INDEX "AfterSalesTicket_organizationId_salesOrderId_idx" ON "AfterSalesTicket"("organizationId", "salesOrderId");

-- CreateIndex
CREATE INDEX "AfterSalesTicket_organizationId_customerId_idx" ON "AfterSalesTicket"("organizationId", "customerId");

-- CreateIndex
CREATE INDEX "AfterSalesTicket_organizationId_assignedToId_status_idx" ON "AfterSalesTicket"("organizationId", "assignedToId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AfterSalesTicket_organizationId_ticketNo_key" ON "AfterSalesTicket"("organizationId", "ticketNo");

-- CreateIndex
CREATE INDEX "AfterSalesComment_organizationId_ticketId_createdAt_idx" ON "AfterSalesComment"("organizationId", "ticketId", "createdAt");

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_salesOrderItemId_fkey" FOREIGN KEY ("salesOrderItemId") REFERENCES "SalesOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_stockLocationId_fkey" FOREIGN KEY ("stockLocationId") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallationTask" ADD CONSTRAINT "InstallationTask_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallationTask" ADD CONSTRAINT "InstallationTask_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallationTask" ADD CONSTRAINT "InstallationTask_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallationTask" ADD CONSTRAINT "InstallationTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallationTask" ADD CONSTRAINT "InstallationTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AfterSalesTicket" ADD CONSTRAINT "AfterSalesTicket_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AfterSalesTicket" ADD CONSTRAINT "AfterSalesTicket_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AfterSalesTicket" ADD CONSTRAINT "AfterSalesTicket_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AfterSalesTicket" ADD CONSTRAINT "AfterSalesTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AfterSalesTicket" ADD CONSTRAINT "AfterSalesTicket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AfterSalesComment" ADD CONSTRAINT "AfterSalesComment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AfterSalesComment" ADD CONSTRAINT "AfterSalesComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "AfterSalesTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AfterSalesComment" ADD CONSTRAINT "AfterSalesComment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
