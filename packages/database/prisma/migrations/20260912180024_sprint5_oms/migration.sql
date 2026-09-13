-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PLANNING', 'IN_PRODUCTION', 'READY_TO_SHIP', 'SHIPPED', 'INSTALLED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED');

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderNo" VARCHAR(60) NOT NULL,
    "contractId" TEXT,
    "customerId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" VARCHAR(180) NOT NULL,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "currency" VARCHAR(10) NOT NULL DEFAULT 'CNY',
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "deliveryAddress" VARCHAR(500),
    "expectedDeliveryAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "notes" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrderItem" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "productId" TEXT,
    "skuId" TEXT,
    "description" VARCHAR(300) NOT NULL,
    "specification" VARCHAR(300),
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" VARCHAR(30) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "productionRequired" BOOLEAN NOT NULL DEFAULT true,
    "fulfilledQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrderStatusHistory" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "fromStatus" "SalesOrderStatus",
    "toStatus" "SalesOrderStatus" NOT NULL,
    "note" TEXT,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesOrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_contractId_key" ON "SalesOrder"("contractId");

-- CreateIndex
CREATE INDEX "SalesOrder_organizationId_ownerId_status_idx" ON "SalesOrder"("organizationId", "ownerId", "status");

-- CreateIndex
CREATE INDEX "SalesOrder_organizationId_customerId_idx" ON "SalesOrder"("organizationId", "customerId");

-- CreateIndex
CREATE INDEX "SalesOrder_organizationId_projectId_idx" ON "SalesOrder"("organizationId", "projectId");

-- CreateIndex
CREATE INDEX "SalesOrder_organizationId_expectedDeliveryAt_idx" ON "SalesOrder"("organizationId", "expectedDeliveryAt");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_organizationId_orderNo_key" ON "SalesOrder"("organizationId", "orderNo");

-- CreateIndex
CREATE INDEX "SalesOrderItem_salesOrderId_sort_idx" ON "SalesOrderItem"("salesOrderId", "sort");

-- CreateIndex
CREATE INDEX "SalesOrderItem_productId_idx" ON "SalesOrderItem"("productId");

-- CreateIndex
CREATE INDEX "SalesOrderItem_skuId_idx" ON "SalesOrderItem"("skuId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrderItem_salesOrderId_lineNo_key" ON "SalesOrderItem"("salesOrderId", "lineNo");

-- CreateIndex
CREATE INDEX "SalesOrderStatusHistory_salesOrderId_createdAt_idx" ON "SalesOrderStatusHistory"("salesOrderId", "createdAt");

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "ProductSku"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderStatusHistory" ADD CONSTRAINT "SalesOrderStatusHistory_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderStatusHistory" ADD CONSTRAINT "SalesOrderStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
