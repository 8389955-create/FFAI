-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'PENDING_SIGNATURE', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "quotationNo" VARCHAR(60) NOT NULL,
    "customerId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" VARCHAR(180) NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" VARCHAR(10) NOT NULL DEFAULT 'CNY',
    "taxRate" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "validUntil" TIMESTAMP(3),
    "notes" TEXT,
    "terms" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationItem" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "productId" TEXT,
    "skuId" TEXT,
    "description" VARCHAR(300) NOT NULL,
    "specification" VARCHAR(300),
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" VARCHAR(30) NOT NULL DEFAULT '件',
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "discountRate" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuotationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contractNo" VARCHAR(60) NOT NULL,
    "quotationId" TEXT,
    "customerId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" VARCHAR(180) NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" VARCHAR(10) NOT NULL DEFAULT 'CNY',
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "depositAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "signedAt" TIMESTAMP(3),
    "effectiveAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "terms" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Quotation_organizationId_ownerId_status_idx" ON "Quotation"("organizationId", "ownerId", "status");

-- CreateIndex
CREATE INDEX "Quotation_organizationId_customerId_idx" ON "Quotation"("organizationId", "customerId");

-- CreateIndex
CREATE INDEX "Quotation_organizationId_projectId_idx" ON "Quotation"("organizationId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_organizationId_quotationNo_key" ON "Quotation"("organizationId", "quotationNo");

-- CreateIndex
CREATE INDEX "QuotationItem_quotationId_sort_idx" ON "QuotationItem"("quotationId", "sort");

-- CreateIndex
CREATE INDEX "QuotationItem_productId_idx" ON "QuotationItem"("productId");

-- CreateIndex
CREATE INDEX "QuotationItem_skuId_idx" ON "QuotationItem"("skuId");

-- CreateIndex
CREATE UNIQUE INDEX "QuotationItem_quotationId_lineNo_key" ON "QuotationItem"("quotationId", "lineNo");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_quotationId_key" ON "Contract"("quotationId");

-- CreateIndex
CREATE INDEX "Contract_organizationId_status_idx" ON "Contract"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Contract_organizationId_customerId_idx" ON "Contract"("organizationId", "customerId");

-- CreateIndex
CREATE INDEX "Contract_organizationId_projectId_idx" ON "Contract"("organizationId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_organizationId_contractNo_key" ON "Contract"("organizationId", "contractNo");

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "ProductSku"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
