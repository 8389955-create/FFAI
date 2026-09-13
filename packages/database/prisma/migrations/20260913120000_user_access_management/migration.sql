-- Extend the unified account with employee/profile and password lifecycle fields.
ALTER TABLE "User"
ADD COLUMN "employeeNo" VARCHAR(50),
ADD COLUMN "jobTitle" VARCHAR(100),
ADD COLUMN "remark" TEXT,
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "passwordChangedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_organizationId_employeeNo_key"
ON "User"("organizationId", "employeeNo");
