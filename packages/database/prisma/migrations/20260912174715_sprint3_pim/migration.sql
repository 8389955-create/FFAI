-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('FINISHED_GOOD', 'CUSTOM_PRODUCT', 'COMPONENT', 'MATERIAL', 'SERVICE');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProductAssetType" AS ENUM ('MAIN_IMAGE', 'GALLERY', 'DETAIL', 'CAD', 'MODEL_3D', 'SPECIFICATION');

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productNo" VARCHAR(80) NOT NULL,
    "type" "ProductType" NOT NULL DEFAULT 'FINISHED_GOOD',
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "categoryId" TEXT,
    "name" VARCHAR(160) NOT NULL,
    "shortName" VARCHAR(100),
    "brand" VARCHAR(80),
    "collection" VARCHAR(100),
    "materialNameCn" VARCHAR(150),
    "materialNameEn" VARCHAR(150),
    "color" VARCHAR(100),
    "lengthMm" INTEGER,
    "widthMm" INTEGER,
    "heightMm" INTEGER,
    "weightKg" DECIMAL(10,3),
    "unit" VARCHAR(30) NOT NULL DEFAULT '件',
    "factoryPrice" DECIMAL(14,2),
    "retailPrice" DECIMAL(14,2),
    "priceMultiplier" DECIMAL(6,2) NOT NULL DEFAULT 1.50,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'CNY',
    "description" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "publicVisible" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSku" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "skuCode" VARCHAR(100) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "barcode" VARCHAR(100),
    "attributes" JSONB,
    "lengthMm" INTEGER,
    "widthMm" INTEGER,
    "heightMm" INTEGER,
    "factoryPrice" DECIMAL(14,2),
    "retailPrice" DECIMAL(14,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSku_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAsset" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "attachmentId" TEXT NOT NULL,
    "type" "ProductAssetType" NOT NULL,
    "title" VARCHAR(150),
    "sort" INTEGER NOT NULL DEFAULT 0,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductCategory_organizationId_parentId_sort_idx" ON "ProductCategory"("organizationId", "parentId", "sort");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_organizationId_code_key" ON "ProductCategory"("organizationId", "code");

-- CreateIndex
CREATE INDEX "Product_organizationId_status_type_idx" ON "Product"("organizationId", "status", "type");

-- CreateIndex
CREATE INDEX "Product_organizationId_categoryId_idx" ON "Product"("organizationId", "categoryId");

-- CreateIndex
CREATE INDEX "Product_organizationId_name_idx" ON "Product"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_organizationId_productNo_key" ON "Product"("organizationId", "productNo");

-- CreateIndex
CREATE INDEX "ProductSku_productId_active_idx" ON "ProductSku"("productId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSku_productId_skuCode_key" ON "ProductSku"("productId", "skuCode");

-- CreateIndex
CREATE INDEX "ProductAsset_productId_type_sort_idx" ON "ProductAsset"("productId", "type", "sort");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAsset_productId_attachmentId_type_key" ON "ProductAsset"("productId", "attachmentId", "type");

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSku" ADD CONSTRAINT "ProductSku_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAsset" ADD CONSTRAINT "ProductAsset_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAsset" ADD CONSTRAINT "ProductAsset_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
