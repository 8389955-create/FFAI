ALTER TABLE "QuotationItem"
ADD COLUMN "materialName" VARCHAR(200),
ADD COLUMN "notes" TEXT;

UPDATE "QuotationItem" AS qi
SET "materialName" = COALESCE(p."materialNameCn", p."materialNameEn")
FROM "Product" AS p
WHERE qi."productId" = p."id" AND qi."materialName" IS NULL;

ALTER TABLE "Contract"
ADD COLUMN "documentSnapshot" JSONB;
