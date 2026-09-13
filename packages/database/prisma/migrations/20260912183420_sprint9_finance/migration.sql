-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'WECHAT', 'ALIPAY', 'CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'PAID', 'REJECTED', 'VOID');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PAID', 'VOID');

-- CreateTable
CREATE TABLE "AccountReceivable" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "receivableNo" VARCHAR(70) NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'UNPAID',
    "currency" VARCHAR(10) NOT NULL DEFAULT 'CNY',
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountReceivable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerReceipt" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "receiptNo" VARCHAR(70) NOT NULL,
    "receivableId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transactionRef" VARCHAR(120),
    "note" TEXT,
    "collectedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountPayable" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "payableNo" VARCHAR(70) NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'UNPAID',
    "currency" VARCHAR(10) NOT NULL DEFAULT 'CNY',
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountPayable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPayment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "paymentNo" VARCHAR(70) NOT NULL,
    "payableId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transactionRef" VARCHAR(120),
    "note" TEXT,
    "paidById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "expenseNo" VARCHAR(70) NOT NULL,
    "category" VARCHAR(80) NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'DRAFT',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "transactionRef" VARCHAR(120),
    "notes" TEXT,
    "applicantId" TEXT NOT NULL,
    "approvedById" TEXT,
    "paidById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "payrollNo" VARCHAR(70) NOT NULL,
    "employeeId" TEXT NOT NULL,
    "period" VARCHAR(7) NOT NULL,
    "baseAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "bonusAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "deductionAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(14,2) NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "paidAt" TIMESTAMP(3),
    "transactionRef" VARCHAR(120),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "paidById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountReceivable_salesOrderId_key" ON "AccountReceivable"("salesOrderId");

-- CreateIndex
CREATE INDEX "AccountReceivable_organizationId_status_dueDate_idx" ON "AccountReceivable"("organizationId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "AccountReceivable_organizationId_customerId_idx" ON "AccountReceivable"("organizationId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountReceivable_organizationId_receivableNo_key" ON "AccountReceivable"("organizationId", "receivableNo");

-- CreateIndex
CREATE INDEX "CustomerReceipt_organizationId_receivedAt_idx" ON "CustomerReceipt"("organizationId", "receivedAt");

-- CreateIndex
CREATE INDEX "CustomerReceipt_receivableId_receivedAt_idx" ON "CustomerReceipt"("receivableId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerReceipt_organizationId_receiptNo_key" ON "CustomerReceipt"("organizationId", "receiptNo");

-- CreateIndex
CREATE UNIQUE INDEX "AccountPayable_purchaseOrderId_key" ON "AccountPayable"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "AccountPayable_organizationId_status_dueDate_idx" ON "AccountPayable"("organizationId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "AccountPayable_organizationId_supplierId_idx" ON "AccountPayable"("organizationId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountPayable_organizationId_payableNo_key" ON "AccountPayable"("organizationId", "payableNo");

-- CreateIndex
CREATE INDEX "SupplierPayment_organizationId_paidAt_idx" ON "SupplierPayment"("organizationId", "paidAt");

-- CreateIndex
CREATE INDEX "SupplierPayment_payableId_paidAt_idx" ON "SupplierPayment"("payableId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPayment_organizationId_paymentNo_key" ON "SupplierPayment"("organizationId", "paymentNo");

-- CreateIndex
CREATE INDEX "Expense_organizationId_status_occurredAt_idx" ON "Expense"("organizationId", "status", "occurredAt");

-- CreateIndex
CREATE INDEX "Expense_organizationId_applicantId_idx" ON "Expense"("organizationId", "applicantId");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_organizationId_expenseNo_key" ON "Expense"("organizationId", "expenseNo");

-- CreateIndex
CREATE INDEX "PayrollRecord_organizationId_status_period_idx" ON "PayrollRecord"("organizationId", "status", "period");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRecord_organizationId_payrollNo_key" ON "PayrollRecord"("organizationId", "payrollNo");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRecord_organizationId_employeeId_period_key" ON "PayrollRecord"("organizationId", "employeeId", "period");

-- AddForeignKey
ALTER TABLE "AccountReceivable" ADD CONSTRAINT "AccountReceivable_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountReceivable" ADD CONSTRAINT "AccountReceivable_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountReceivable" ADD CONSTRAINT "AccountReceivable_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountReceivable" ADD CONSTRAINT "AccountReceivable_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReceipt" ADD CONSTRAINT "CustomerReceipt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReceipt" ADD CONSTRAINT "CustomerReceipt_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "AccountReceivable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReceipt" ADD CONSTRAINT "CustomerReceipt_collectedById_fkey" FOREIGN KEY ("collectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountPayable" ADD CONSTRAINT "AccountPayable_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountPayable" ADD CONSTRAINT "AccountPayable_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountPayable" ADD CONSTRAINT "AccountPayable_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountPayable" ADD CONSTRAINT "AccountPayable_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "AccountPayable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
