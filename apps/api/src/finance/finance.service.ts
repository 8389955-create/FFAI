import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SettlementStatus } from '@ffai/database';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto, CreatePayrollDto, FinanceListQueryDto, PayExpenseDto, PayPayrollDto, RecordMoneyDto } from './dto/finance.dto';
import { FieldPermissionService } from '../common/field-permission.service';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService, private readonly fields: FieldPermissionService) {}

  async dashboard(user: AuthUser) {
    await this.refreshOverdue(user.organizationId);
    const receivableWhere: Prisma.AccountReceivableWhereInput = { organizationId: user.organizationId, ...this.receivableScope(user), status: { not: 'VOID' } };
    const payableWhere: Prisma.AccountPayableWhereInput = { organizationId: user.organizationId, ...this.payableScope(user), status: { not: 'VOID' } };
    const expenseWhere: Prisma.ExpenseWhereInput = { organizationId: user.organizationId, ...this.expenseScope(user), status: { in: ['APPROVED', 'PAID'] } };
    const payrollWhere: Prisma.PayrollRecordWhereInput = { organizationId: user.organizationId, status: { in: ['CONFIRMED', 'PAID'] } };
    const orderWhere: Prisma.SalesOrderWhereInput = { organizationId: user.organizationId, ...this.orderScope(user), status: { notIn: ['DRAFT', 'CANCELLED'] } };
    const purchaseWhere: Prisma.PurchaseOrderWhereInput = { organizationId: user.organizationId, ...this.purchaseScope(user), status: { notIn: ['DRAFT', 'PENDING_APPROVAL', 'CANCELLED'] } };
    const [ar, ap, expenses, payroll, orders, purchases, receipts, supplierPayments, paidExpenses, paidPayroll, recentReceipts, recentPayments] = await this.prisma.$transaction([
      this.prisma.accountReceivable.aggregate({ where: receivableWhere, _sum: { totalAmount: true, paidAmount: true }, _count: true }),
      this.prisma.accountPayable.aggregate({ where: payableWhere, _sum: { totalAmount: true, paidAmount: true }, _count: true }),
      this.prisma.expense.aggregate({ where: expenseWhere, _sum: { amount: true }, _count: true }),
      this.prisma.payrollRecord.aggregate({ where: payrollWhere, _sum: { netAmount: true }, _count: true }),
      this.prisma.salesOrder.aggregate({ where: orderWhere, _sum: { totalAmount: true }, _count: true }),
      this.prisma.purchaseOrder.aggregate({ where: purchaseWhere, _sum: { totalAmount: true }, _count: true }),
      this.prisma.customerReceipt.aggregate({ where: { organizationId: user.organizationId, receivable: this.receivableScope(user) }, _sum: { amount: true } }),
      this.prisma.supplierPayment.aggregate({ where: { organizationId: user.organizationId, payable: this.payableScope(user) }, _sum: { amount: true } }),
      this.prisma.expense.aggregate({ where: { organizationId: user.organizationId, ...this.expenseScope(user), status: 'PAID' }, _sum: { amount: true } }),
      this.prisma.payrollRecord.aggregate({ where: { organizationId: user.organizationId, status: 'PAID' }, _sum: { netAmount: true } }),
      this.prisma.customerReceipt.findMany({ where: { organizationId: user.organizationId, receivable: this.receivableScope(user) }, include: { receivable: { include: { customer: { select: { name: true } }, salesOrder: { select: { orderNo: true } } } }, collectedBy: { select: { displayName: true } } }, orderBy: { receivedAt: 'desc' }, take: 5 }),
      this.prisma.supplierPayment.findMany({ where: { organizationId: user.organizationId, payable: this.payableScope(user) }, include: { payable: { include: { supplier: { select: { name: true } }, purchaseOrder: { select: { purchaseOrderNo: true } } } }, paidBy: { select: { displayName: true } } }, orderBy: { paidAt: 'desc' }, take: 5 }),
    ]);
    const arTotal = Number(ar._sum.totalAmount ?? 0), arPaid = Number(ar._sum.paidAmount ?? 0);
    const apTotal = Number(ap._sum.totalAmount ?? 0), apPaid = Number(ap._sum.paidAmount ?? 0);
    const orderValue = Number(orders._sum.totalAmount ?? 0), purchaseValue = Number(purchases._sum.totalAmount ?? 0), expenseValue = Number(expenses._sum.amount ?? 0), payrollValue = Number(payroll._sum.netAmount ?? 0);
    const cashIn = Number(receipts._sum.amount ?? 0), cashOut = Number(supplierPayments._sum.amount ?? 0) + Number(paidExpenses._sum.amount ?? 0) + Number(paidPayroll._sum.netAmount ?? 0);
    return {
      receivables: { count: ar._count, total: arTotal, paid: arPaid, outstanding: arTotal - arPaid },
      payables: { count: ap._count, total: apTotal, paid: apPaid, outstanding: apTotal - apPaid },
      operating: { orderValue, purchaseValue, expenseValue, payrollValue, estimatedContribution: orderValue - purchaseValue - expenseValue - payrollValue },
      cash: { in: cashIn, out: cashOut, net: cashIn - cashOut },
      recent: [
        ...recentReceipts.map((item) => ({ id: item.id, no: item.receiptNo, direction: 'IN', amount: Number(item.amount), party: item.receivable.customer.name, sourceNo: item.receivable.salesOrder.orderNo, occurredAt: item.receivedAt })),
        ...recentPayments.map((item) => ({ id: item.id, no: item.paymentNo, direction: 'OUT', amount: Number(item.amount), party: item.payable.supplier.name, sourceNo: item.payable.purchaseOrder.purchaseOrderNo, occurredAt: item.paidAt })),
      ].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()).slice(0, 8),
    };
  }

  async receivables(user: AuthUser, query: FinanceListQueryDto) {
    await this.refreshOverdue(user.organizationId);
    const where: Prisma.AccountReceivableWhereInput = { organizationId: user.organizationId, ...this.receivableScope(user), status: query.settlementStatus, ...(query.keyword ? { OR: [{ receivableNo: { contains: query.keyword, mode: 'insensitive' } }, { salesOrder: { orderNo: { contains: query.keyword, mode: 'insensitive' } } }, { customer: { name: { contains: query.keyword, mode: 'insensitive' } } }] } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.accountReceivable.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, include: { customer: { select: { customerNo: true, name: true } }, salesOrder: { select: { orderNo: true, title: true, owner: { select: { displayName: true } } } }, receipts: { include: { collectedBy: { select: { displayName: true } } }, orderBy: { receivedAt: 'desc' } } }, orderBy: { updatedAt: 'desc' } }),
      this.prisma.accountReceivable.count({ where }),
    ]);
    return { items: items.map((item) => ({ ...item, outstandingAmount: Number(item.totalAmount) - Number(item.paidAmount) })), total, page: query.page, pageSize: query.pageSize };
  }

  async syncReceivables(user: AuthUser) {
    const orders = await this.prisma.salesOrder.findMany({ where: { organizationId: user.organizationId, status: { notIn: ['DRAFT', 'CANCELLED'] }, receivable: null }, select: { id: true } });
    let created = 0;
    for (const candidate of orders) {
      const wasCreated = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`finance-ar:${candidate.id}`}))`;
        if (await tx.accountReceivable.findUnique({ where: { salesOrderId: candidate.id } })) return false;
        const order = await tx.salesOrder.findUniqueOrThrow({ where: { id: candidate.id } });
        const receivableNo = await this.nextNumber(tx, user.organizationId, 'RECEIVABLE');
        const status = this.settlementStatus(Number(order.paidAmount), Number(order.totalAmount), order.expectedDeliveryAt);
        await tx.accountReceivable.create({ data: { organizationId: user.organizationId, receivableNo, salesOrderId: order.id, customerId: order.customerId, totalAmount: order.totalAmount, paidAmount: order.paidAmount, currency: order.currency, status, dueDate: order.expectedDeliveryAt, createdById: user.sub } });
        return true;
      });
      if (wasCreated) created++;
    }
    return { discovered: orders.length, created };
  }

  collect(user: AuthUser, id: string, input: RecordMoneyDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`finance-ar-payment:${id}`}))`;
      const receivable = await tx.accountReceivable.findFirst({ where: { id, organizationId: user.organizationId, ...this.receivableScope(user) } });
      if (!receivable || receivable.status === 'VOID') throw new NotFoundException('应收单不存在或不可收款');
      const remaining = Number(receivable.totalAmount) - Number(receivable.paidAmount);
      if (input.amount > remaining + 0.001) throw new BadRequestException(`收款金额超过未收金额 ${remaining.toFixed(2)}`);
      const receiptNo = await this.nextNumber(tx, user.organizationId, 'RECEIPT');
      const paidAmount = Number(receivable.paidAmount) + input.amount;
      const status = this.settlementStatus(paidAmount, Number(receivable.totalAmount), receivable.dueDate);
      const receipt = await tx.customerReceipt.create({ data: { organizationId: user.organizationId, receiptNo, receivableId: id, amount: input.amount, method: input.method, receivedAt: input.occurredAt ? new Date(input.occurredAt) : undefined, transactionRef: input.transactionRef, note: input.note, collectedById: user.sub } });
      await tx.accountReceivable.update({ where: { id }, data: { paidAmount, status } });
      await tx.salesOrder.update({ where: { id: receivable.salesOrderId }, data: { paidAmount, paymentStatus: status === 'PAID' ? 'PAID' : paidAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID' } });
      return receipt;
    });
  }

  async payables(user: AuthUser, query: FinanceListQueryDto) {
    await this.refreshOverdue(user.organizationId);
    const where: Prisma.AccountPayableWhereInput = { organizationId: user.organizationId, ...this.payableScope(user), status: query.settlementStatus, ...(query.keyword ? { OR: [{ payableNo: { contains: query.keyword, mode: 'insensitive' } }, { purchaseOrder: { purchaseOrderNo: { contains: query.keyword, mode: 'insensitive' } } }, { supplier: { name: { contains: query.keyword, mode: 'insensitive' } } }] } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.accountPayable.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, include: { supplier: { select: { supplierNo: true, name: true } }, purchaseOrder: { select: { purchaseOrderNo: true, status: true, buyer: { select: { displayName: true } } } }, payments: { include: { paidBy: { select: { displayName: true } } }, orderBy: { paidAt: 'desc' } } }, orderBy: { updatedAt: 'desc' } }),
      this.prisma.accountPayable.count({ where }),
    ]);
    return { items: items.map((item) => ({ ...item, outstandingAmount: Number(item.totalAmount) - Number(item.paidAmount) })), total, page: query.page, pageSize: query.pageSize };
  }

  async syncPayables(user: AuthUser) {
    const orders = await this.prisma.purchaseOrder.findMany({ where: { organizationId: user.organizationId, status: { in: ['APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED'] }, payable: null }, select: { id: true } });
    let created = 0;
    for (const candidate of orders) {
      const wasCreated = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`finance-ap:${candidate.id}`}))`;
        if (await tx.accountPayable.findUnique({ where: { purchaseOrderId: candidate.id } })) return false;
        const order = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: candidate.id } });
        const payableNo = await this.nextNumber(tx, user.organizationId, 'PAYABLE');
        await tx.accountPayable.create({ data: { organizationId: user.organizationId, payableNo, purchaseOrderId: order.id, supplierId: order.supplierId, totalAmount: order.totalAmount, currency: order.currency, status: 'UNPAID', dueDate: order.expectedArrivalAt, createdById: user.sub } });
        return true;
      });
      if (wasCreated) created++;
    }
    return { discovered: orders.length, created };
  }

  paySupplier(user: AuthUser, id: string, input: RecordMoneyDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`finance-ap-payment:${id}`}))`;
      const payable = await tx.accountPayable.findFirst({ where: { id, organizationId: user.organizationId, ...this.payableScope(user) } });
      if (!payable || payable.status === 'VOID') throw new NotFoundException('应付单不存在或不可付款');
      const remaining = Number(payable.totalAmount) - Number(payable.paidAmount);
      if (input.amount > remaining + 0.001) throw new BadRequestException(`付款金额超过未付金额 ${remaining.toFixed(2)}`);
      const paymentNo = await this.nextNumber(tx, user.organizationId, 'PAYMENT');
      const paidAmount = Number(payable.paidAmount) + input.amount;
      const status = this.settlementStatus(paidAmount, Number(payable.totalAmount), payable.dueDate);
      const payment = await tx.supplierPayment.create({ data: { organizationId: user.organizationId, paymentNo, payableId: id, amount: input.amount, method: input.method, paidAt: input.occurredAt ? new Date(input.occurredAt) : undefined, transactionRef: input.transactionRef, note: input.note, paidById: user.sub } });
      await tx.accountPayable.update({ where: { id }, data: { paidAmount, status } });
      return payment;
    });
  }

  async expenses(user: AuthUser, query: FinanceListQueryDto) {
    const where: Prisma.ExpenseWhereInput = { organizationId: user.organizationId, ...this.expenseScope(user), status: query.expenseStatus, ...(query.keyword ? { OR: [{ expenseNo: { contains: query.keyword, mode: 'insensitive' } }, { description: { contains: query.keyword, mode: 'insensitive' } }, { category: { contains: query.keyword, mode: 'insensitive' } }] } : {}) };
    const [items, total] = await this.prisma.$transaction([this.prisma.expense.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, include: { applicant: { select: { displayName: true } }, approvedBy: { select: { displayName: true } }, paidBy: { select: { displayName: true } } }, orderBy: { occurredAt: 'desc' } }), this.prisma.expense.count({ where })]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  createExpense(user: AuthUser, input: CreateExpenseDto) {
    return this.prisma.$transaction(async (tx) => {
      const expenseNo = await this.nextNumber(tx, user.organizationId, 'EXPENSE');
      return tx.expense.create({ data: { organizationId: user.organizationId, expenseNo, category: input.category, description: input.description, amount: input.amount, taxAmount: input.taxAmount, occurredAt: new Date(input.occurredAt), dueDate: input.dueDate ? new Date(input.dueDate) : undefined, notes: input.notes, applicantId: user.sub } });
    });
  }

  async submitExpense(user: AuthUser, id: string) { const expense = await this.getExpense(user, id); if (expense.status !== 'DRAFT') throw new BadRequestException('只有草稿费用可以提交'); return this.prisma.expense.update({ where: { id }, data: { status: 'SUBMITTED' } }); }
  async approveExpense(user: AuthUser, id: string) { const expense = await this.getExpense(user, id); if (expense.status !== 'SUBMITTED') throw new BadRequestException('只有已提交费用可以审批'); return this.prisma.expense.update({ where: { id }, data: { status: 'APPROVED', approvedById: user.sub, approvedAt: new Date() } }); }
  async rejectExpense(user: AuthUser, id: string) { const expense = await this.getExpense(user, id); if (expense.status !== 'SUBMITTED') throw new BadRequestException('只有已提交费用可以驳回'); return this.prisma.expense.update({ where: { id }, data: { status: 'REJECTED', approvedById: user.sub, approvedAt: new Date() } }); }
  async payExpense(user: AuthUser, id: string, input: PayExpenseDto) { const expense = await this.getExpense(user, id); if (expense.status !== 'APPROVED') throw new BadRequestException('只有已审批费用可以支付'); return this.prisma.expense.update({ where: { id }, data: { status: 'PAID', paidById: user.sub, paidAt: input.paidAt ? new Date(input.paidAt) : new Date(), transactionRef: input.transactionRef } }); }

  async payroll(user: AuthUser, query: FinanceListQueryDto) {
    const where: Prisma.PayrollRecordWhereInput = { organizationId: user.organizationId, status: query.payrollStatus, period: query.period, ...(query.keyword ? { OR: [{ payrollNo: { contains: query.keyword, mode: 'insensitive' } }, { employee: { displayName: { contains: query.keyword, mode: 'insensitive' } } }] } : {}) };
    const [items, total] = await this.prisma.$transaction([this.prisma.payrollRecord.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, include: { employee: { select: { id: true, username: true, displayName: true } }, createdBy: { select: { displayName: true } }, paidBy: { select: { displayName: true } } }, orderBy: [{ period: 'desc' }, { createdAt: 'desc' }] }), this.prisma.payrollRecord.count({ where })]);
    return { items: await Promise.all(items.map((item) => this.fields.redact(user, 'finance.payroll', item, ['baseAmount', 'bonusAmount', 'deductionAmount', 'netAmount']))), total, page: query.page, pageSize: query.pageSize };
  }

  employees(user: AuthUser) { return this.prisma.user.findMany({ where: { organizationId: user.organizationId, status: 'ACTIVE' }, select: { id: true, username: true, displayName: true }, orderBy: { displayName: 'asc' } }); }

  async createPayroll(user: AuthUser, input: CreatePayrollDto) {
    await this.fields.assertWritable(user, 'finance.payroll', ['baseAmount', 'bonusAmount', 'deductionAmount', 'netAmount']);
    const employee = await this.prisma.user.findFirst({ where: { id: input.employeeId, organizationId: user.organizationId, status: 'ACTIVE' } });
    if (!employee) throw new BadRequestException('员工不存在或已停用');
    if (await this.prisma.payrollRecord.findUnique({ where: { organizationId_employeeId_period: { organizationId: user.organizationId, employeeId: input.employeeId, period: input.period } } })) throw new BadRequestException('该员工本月工资单已存在');
    const netAmount = input.baseAmount + (input.bonusAmount ?? 0) - (input.deductionAmount ?? 0);
    if (netAmount < 0) throw new BadRequestException('实发工资不能为负数');
    return this.prisma.$transaction(async (tx) => { const payrollNo = await this.nextNumber(tx, user.organizationId, 'PAYROLL'); return tx.payrollRecord.create({ data: { organizationId: user.organizationId, payrollNo, employeeId: input.employeeId, period: input.period, baseAmount: input.baseAmount, bonusAmount: input.bonusAmount, deductionAmount: input.deductionAmount, netAmount, notes: input.notes, createdById: user.sub } }); });
  }

  async confirmPayroll(user: AuthUser, id: string) { const payroll = await this.getPayroll(user, id); if (payroll.status !== 'DRAFT') throw new BadRequestException('只有草稿工资单可以确认'); return this.prisma.payrollRecord.update({ where: { id }, data: { status: 'CONFIRMED' } }); }
  async payPayroll(user: AuthUser, id: string, input: PayPayrollDto) { const payroll = await this.getPayroll(user, id); if (payroll.status !== 'CONFIRMED') throw new BadRequestException('只有已确认工资单可以支付'); return this.prisma.payrollRecord.update({ where: { id }, data: { status: 'PAID', paidById: user.sub, paidAt: input.paidAt ? new Date(input.paidAt) : new Date(), transactionRef: input.transactionRef } }); }

  private async getExpense(user: AuthUser, id: string) { const expense = await this.prisma.expense.findFirst({ where: { id, organizationId: user.organizationId, ...this.expenseScope(user) } }); if (!expense) throw new NotFoundException('费用单不存在或不在数据范围内'); return expense; }
  private async getPayroll(user: AuthUser, id: string) { const payroll = await this.prisma.payrollRecord.findFirst({ where: { id, organizationId: user.organizationId } }); if (!payroll) throw new NotFoundException('工资单不存在'); return payroll; }
  private receivableScope(user: AuthUser): Prisma.AccountReceivableWhereInput { return this.isBroad(user) ? {} : { salesOrder: this.orderScope(user) }; }
  private payableScope(user: AuthUser): Prisma.AccountPayableWhereInput { return this.isBroad(user) ? {} : { purchaseOrder: this.purchaseScope(user) }; }
  private expenseScope(user: AuthUser): Prisma.ExpenseWhereInput { return this.isBroad(user) ? {} : { applicantId: user.sub }; }
  private orderScope(user: AuthUser): Prisma.SalesOrderWhereInput { return this.isBroad(user) ? {} : { OR: [{ ownerId: user.sub }, { project: { members: { some: { userId: user.sub } } } }] }; }
  private purchaseScope(user: AuthUser): Prisma.PurchaseOrderWhereInput { return this.isBroad(user) ? {} : { OR: [{ buyerId: user.sub }, { salesOrder: this.orderScope(user) }] }; }
  private isBroad(user: AuthUser) { return user.dataScopes.includes('ALL') || user.dataScopes.includes('COMPANY'); }
  private settlementStatus(paid: number, total: number, dueDate?: Date | null): SettlementStatus { if (paid >= total - 0.001) return 'PAID'; if (dueDate && dueDate.getTime() < Date.now()) return 'OVERDUE'; return paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID'; }
  private async refreshOverdue(organizationId: string) { await Promise.all([this.prisma.accountReceivable.updateMany({ where: { organizationId, dueDate: { lt: new Date() }, status: { in: ['UNPAID', 'PARTIALLY_PAID'] } }, data: { status: 'OVERDUE' } }), this.prisma.accountPayable.updateMany({ where: { organizationId, dueDate: { lt: new Date() }, status: { in: ['UNPAID', 'PARTIALLY_PAID'] } }, data: { status: 'OVERDUE' } })]); }
  private async nextNumber(tx: Prisma.TransactionClient, organizationId: string, code: string) { await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${organizationId}:${code}`}))`; const rule = await tx.businessNumberRule.findUnique({ where: { organizationId_code: { organizationId, code } } }); if (!rule || !rule.active) throw new NotFoundException(`业务编号规则 ${code} 不存在`); const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).replaceAll('-', ''); const next = rule.currentDate === date ? rule.currentValue + 1 : 1; await tx.businessNumberRule.update({ where: { id: rule.id }, data: { currentDate: date, currentValue: next } }); return `${rule.prefix}-${date}-${String(next).padStart(rule.sequenceLength, '0')}`; }
}
