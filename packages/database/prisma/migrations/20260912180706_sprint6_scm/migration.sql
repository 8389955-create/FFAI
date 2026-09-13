-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLACKLISTED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplierNo" VARCHAR(60) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "shortName" VARCHAR(100),
    "status" "SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
    "contactName" VARCHAR(100),
    "phone" VARCHAR(30),
    "email" VARCHAR(255),
    "taxNo" VARCHAR(80),
    "address" VARCHAR(500),
    "paymentTerms" VARCHAR(300),
    "leadDays" INTEGER,
    "rating" DECIMAL(3,2),
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "purchaseOrderNo" VARCHAR(60) NOT NULL,
    "supplierId" TEXT NOT NULL,
    "salesOrderId" TEXT,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" VARCHAR(10) NOT NULL DEFAULT 'CNY',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "expectedArrivalAt" TIMESTAMP(3),
    "orderedAt" TIMESTAMP(3),
    "notes" TEXT,
    "buyerId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "productId" TEXT,
    "skuId" TEXT,
    "description" VARCHAR(300) NOT NULL,
    "specification" VARCHAR(300),
    "quantity" DECIMAL(12,3) NOT NULL,
    "receivedQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "unit" VARCHAR(30) NOT NULL DEFAULT '件',
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "taxRate" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Supplier_organizationId_status_idx" ON "Supplier"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Supplier_organizationId_name_idx" ON "Supplier"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_organizationId_supplierNo_key" ON "Supplier"("organizationId", "supplierNo");

-- CreateIndex
CREATE INDEX "PurchaseOrder_organizationId_buyerId_status_idx" ON "PurchaseOrder"("organizationId", "buyerId", "status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_organizationId_supplierId_idx" ON "PurchaseOrder"("organizationId", "supplierId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_organizationId_salesOrderId_idx" ON "PurchaseOrder"("organizationId", "salesOrderId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_organizationId_expectedArrivalAt_idx" ON "PurchaseOrder"("organizationId", "expectedArrivalAt");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_organizationId_purchaseOrderNo_key" ON "PurchaseOrder"("organizationId", "purchaseOrderNo");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_purchaseOrderId_sort_idx" ON "PurchaseOrderItem"("purchaseOrderId", "sort");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_productId_idx" ON "PurchaseOrderItem"("productId");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_skuId_idx" ON "PurchaseOrderItem"("skuId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrderItem_purchaseOrderId_lineNo_key" ON "PurchaseOrderItem"("purchaseOrderId", "lineNo");

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "ProductSku"("id") ON DELETE SET NULL ON UPDATE CASCADE;
