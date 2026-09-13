import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AlertSeverity, AlertStatus, Prisma, WorkTaskStatus } from '@ffai/database';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { AlertListQueryDto, CreateTaskDto, TaskListQueryDto, UpdateAlertDto, UpdateTaskDto } from './dto/tasks.dto';

type AlertCandidate = {
  fingerprint: string;
  category: string;
  severity: AlertSeverity;
  title: string;
  description?: string;
  sourceType?: string;
  sourceId?: string;
  sourceNo?: string;
  dueAt?: Date | null;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(user: AuthUser) {
    const now = new Date();
    const taskWhere: Prisma.WorkTaskWhereInput = { organizationId: user.organizationId, ...this.taskScope(user) };
    const [taskGroups, overdue, dueSoon, alertGroups, severityGroups, upcomingTasks, criticalAlerts] = await this.prisma.$transaction([
      this.prisma.workTask.groupBy({ by: ['status'], where: taskWhere, orderBy: { status: 'asc' }, _count: true }),
      this.prisma.workTask.count({ where: { ...taskWhere, status: { notIn: ['DONE', 'CANCELLED'] }, dueAt: { lt: now } } }),
      this.prisma.workTask.count({ where: { ...taskWhere, status: { notIn: ['DONE', 'CANCELLED'] }, dueAt: { gte: now, lte: new Date(now.getTime() + 3 * 86400000) } } }),
      this.prisma.alertEvent.groupBy({ by: ['status'], where: { organizationId: user.organizationId }, orderBy: { status: 'asc' }, _count: true }),
      this.prisma.alertEvent.groupBy({ by: ['severity'], where: { organizationId: user.organizationId, status: { in: ['OPEN', 'ACKNOWLEDGED'] } }, orderBy: { severity: 'asc' }, _count: true }),
      this.prisma.workTask.findMany({ where: { ...taskWhere, status: { notIn: ['DONE', 'CANCELLED'] } }, include: { assignee: { select: { id: true, displayName: true } } }, orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { priority: 'desc' }], take: 6 }),
      this.prisma.alertEvent.findMany({ where: { organizationId: user.organizationId, status: { in: ['OPEN', 'ACKNOWLEDGED'] }, severity: { in: ['CRITICAL', 'WARNING'] } }, orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }], take: 6 }),
    ]);
    return {
      tasks: Object.fromEntries(taskGroups.map((item) => [item.status, item._count])),
      overdue,
      dueSoon,
      alerts: Object.fromEntries(alertGroups.map((item) => [item.status, item._count])),
      severities: Object.fromEntries(severityGroups.map((item) => [item.severity, item._count])),
      upcomingTasks,
      criticalAlerts,
    };
  }

  assignees(user: AuthUser) {
    return this.prisma.user.findMany({
      where: { organizationId: user.organizationId, status: 'ACTIVE', roles: { some: { role: { code: { notIn: ['CUSTOMER', 'DEALER'] } } } } },
      select: { id: true, username: true, displayName: true },
      orderBy: { displayName: 'asc' },
    });
  }

  async tasks(user: AuthUser, query: TaskListQueryDto) {
    const where: Prisma.WorkTaskWhereInput = {
      organizationId: user.organizationId,
      ...this.taskScope(user),
      status: query.taskStatus,
      priority: query.priority,
      ...(query.overdue ? { status: { notIn: ['DONE', 'CANCELLED'] }, dueAt: { lt: new Date() } } : {}),
      ...(query.keyword ? { OR: [{ taskNo: { contains: query.keyword, mode: 'insensitive' } }, { title: { contains: query.keyword, mode: 'insensitive' } }, { sourceNo: { contains: query.keyword, mode: 'insensitive' } }] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.workTask.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, include: { assignee: { select: { id: true, username: true, displayName: true } }, createdBy: { select: { id: true, displayName: true } } }, orderBy: [{ status: 'asc' }, { dueAt: { sort: 'asc', nulls: 'last' } }, { updatedAt: 'desc' }] }),
      this.prisma.workTask.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async createTask(user: AuthUser, input: CreateTaskDto) {
    await this.assertAssignee(user.organizationId, input.assigneeId);
    return this.prisma.$transaction(async (tx) => {
      const taskNo = await this.nextNumber(tx, user.organizationId, 'TASK');
      return tx.workTask.create({ data: { organizationId: user.organizationId, taskNo, title: input.title, description: input.description, priority: input.priority, dueAt: input.dueAt ? new Date(input.dueAt) : undefined, reminderAt: input.reminderAt ? new Date(input.reminderAt) : undefined, sourceType: input.sourceType, sourceId: input.sourceId, sourceNo: input.sourceNo, tags: input.tags ?? [], assigneeId: input.assigneeId, createdById: user.sub }, include: { assignee: { select: { id: true, displayName: true } } } });
    });
  }

  async updateTask(user: AuthUser, id: string, input: UpdateTaskDto) {
    const current = await this.prisma.workTask.findFirst({ where: { id, organizationId: user.organizationId, ...this.taskScope(user) } });
    if (!current) throw new NotFoundException('任务不存在或不在数据范围内');
    if (input.assigneeId) await this.assertAssignee(user.organizationId, input.assigneeId);
    if (input.status && input.status !== current.status) this.assertTaskTransition(current.status, input.status);
    return this.prisma.workTask.update({
      where: { id },
      data: { title: input.title, description: input.description, priority: input.priority, dueAt: input.dueAt ? new Date(input.dueAt) : undefined, reminderAt: input.reminderAt ? new Date(input.reminderAt) : undefined, assigneeId: input.assigneeId, tags: input.tags, status: input.status, completedAt: input.status === 'DONE' ? new Date() : input.status && current.status === 'DONE' ? null : undefined },
      include: { assignee: { select: { id: true, displayName: true } }, createdBy: { select: { id: true, displayName: true } } },
    });
  }

  async alerts(user: AuthUser, query: AlertListQueryDto) {
    const where: Prisma.AlertEventWhereInput = { organizationId: user.organizationId, status: query.alertStatus, ...(query.keyword ? { OR: [{ title: { contains: query.keyword, mode: 'insensitive' } }, { sourceNo: { contains: query.keyword, mode: 'insensitive' } }, { category: { contains: query.keyword, mode: 'insensitive' } }] } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.alertEvent.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, include: { acknowledgedBy: { select: { displayName: true } }, resolvedBy: { select: { displayName: true } } }, orderBy: [{ status: 'asc' }, { severity: 'desc' }, { detectedAt: 'desc' }] }),
      this.prisma.alertEvent.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async scanAlerts(user: AuthUser) {
    const now = new Date();
    const org = user.organizationId;
    const dayAgo = new Date(now.getTime() - 86400000);
    const [orders, purchases, workOrders, receivables, payables, shipments, installations, tickets, balances] = await Promise.all([
      this.prisma.salesOrder.findMany({ where: { organizationId: org, expectedDeliveryAt: { lt: now }, status: { notIn: ['INSTALLED', 'COMPLETED', 'CANCELLED'] } }, select: { id: true, orderNo: true, title: true, status: true, expectedDeliveryAt: true } }),
      this.prisma.purchaseOrder.findMany({ where: { organizationId: org, expectedArrivalAt: { lt: now }, status: { notIn: ['RECEIVED', 'CANCELLED'] } }, select: { id: true, purchaseOrderNo: true, status: true, expectedArrivalAt: true, supplier: { select: { name: true } } } }),
      this.prisma.workOrder.findMany({ where: { organizationId: org, plannedEndAt: { lt: now }, status: { notIn: ['COMPLETED', 'CANCELLED'] } }, select: { id: true, workOrderNo: true, operationName: true, status: true, plannedEndAt: true } }),
      this.prisma.accountReceivable.findMany({ where: { organizationId: org, dueDate: { lt: now }, status: { notIn: ['PAID', 'VOID'] } }, select: { id: true, receivableNo: true, totalAmount: true, paidAmount: true, dueDate: true, customer: { select: { name: true } } } }),
      this.prisma.accountPayable.findMany({ where: { organizationId: org, dueDate: { lt: now }, status: { notIn: ['PAID', 'VOID'] } }, select: { id: true, payableNo: true, totalAmount: true, paidAmount: true, dueDate: true, supplier: { select: { name: true } } } }),
      this.prisma.shipment.findMany({ where: { organizationId: org, scheduledAt: { lt: now }, status: { notIn: ['DELIVERED', 'CANCELLED'] } }, select: { id: true, shipmentNo: true, status: true, scheduledAt: true } }),
      this.prisma.installationTask.findMany({ where: { organizationId: org, scheduledEndAt: { lt: now }, status: { in: ['SCHEDULED', 'IN_PROGRESS'] } }, select: { id: true, installationNo: true, status: true, scheduledEndAt: true } }),
      this.prisma.afterSalesTicket.findMany({ where: { organizationId: org, reportedAt: { lt: dayAgo }, priority: { in: ['HIGH', 'URGENT'] }, status: { notIn: ['RESOLVED', 'CLOSED', 'CANCELLED'] } }, select: { id: true, ticketNo: true, title: true, priority: true, status: true, reportedAt: true } }),
      this.prisma.inventoryBalance.findMany({ where: { organizationId: org }, select: { id: true, quantity: true, reservedQuantity: true, product: { select: { productNo: true, name: true } }, sku: { select: { skuCode: true } }, warehouse: { select: { name: true } }, location: { select: { code: true } } } }),
    ]);
    const candidates: AlertCandidate[] = [];
    const add = (candidate: Omit<AlertCandidate, 'fingerprint'> & { sourceType: string; sourceId: string }) => candidates.push({ ...candidate, fingerprint: `${candidate.category}:${candidate.sourceType}:${candidate.sourceId}` });
    for (const x of orders) add({ category: 'ORDER_DELIVERY_OVERDUE', severity: 'CRITICAL', title: `订单 ${x.orderNo} 已逾交期`, description: `${x.title} 当前状态 ${x.status}`, sourceType: 'SALES_ORDER', sourceId: x.id, sourceNo: x.orderNo, dueAt: x.expectedDeliveryAt });
    for (const x of purchases) add({ category: 'PURCHASE_ARRIVAL_OVERDUE', severity: 'WARNING', title: `采购单 ${x.purchaseOrderNo} 到货逾期`, description: `${x.supplier.name} 当前状态 ${x.status}`, sourceType: 'PURCHASE_ORDER', sourceId: x.id, sourceNo: x.purchaseOrderNo, dueAt: x.expectedArrivalAt });
    for (const x of workOrders) add({ category: 'WORK_ORDER_OVERDUE', severity: 'CRITICAL', title: `工单 ${x.workOrderNo} 已超期`, description: `${x.operationName} 当前状态 ${x.status}`, sourceType: 'WORK_ORDER', sourceId: x.id, sourceNo: x.workOrderNo, dueAt: x.plannedEndAt });
    for (const x of receivables) add({ category: 'RECEIVABLE_OVERDUE', severity: 'CRITICAL', title: `应收 ${x.receivableNo} 已逾期`, description: `${x.customer.name} 尚欠 ¥${(Number(x.totalAmount) - Number(x.paidAmount)).toFixed(2)}`, sourceType: 'RECEIVABLE', sourceId: x.id, sourceNo: x.receivableNo, dueAt: x.dueDate });
    for (const x of payables) add({ category: 'PAYABLE_OVERDUE', severity: 'WARNING', title: `应付 ${x.payableNo} 已逾期`, description: `${x.supplier.name} 待付 ¥${(Number(x.totalAmount) - Number(x.paidAmount)).toFixed(2)}`, sourceType: 'PAYABLE', sourceId: x.id, sourceNo: x.payableNo, dueAt: x.dueDate });
    for (const x of shipments) add({ category: 'SHIPMENT_OVERDUE', severity: 'WARNING', title: `配送 ${x.shipmentNo} 未按计划完成`, description: `当前状态 ${x.status}`, sourceType: 'SHIPMENT', sourceId: x.id, sourceNo: x.shipmentNo, dueAt: x.scheduledAt });
    for (const x of installations) add({ category: 'INSTALLATION_OVERDUE', severity: 'WARNING', title: `安装 ${x.installationNo} 已超时`, description: `当前状态 ${x.status}`, sourceType: 'INSTALLATION', sourceId: x.id, sourceNo: x.installationNo, dueAt: x.scheduledEndAt });
    for (const x of tickets) add({ category: 'AFTER_SALES_STALE', severity: x.priority === 'URGENT' ? 'CRITICAL' : 'WARNING', title: `售后 ${x.ticketNo} 超过 24 小时未闭环`, description: `${x.title} · ${x.status}`, sourceType: 'AFTER_SALES', sourceId: x.id, sourceNo: x.ticketNo, dueAt: x.reportedAt });
    for (const x of balances.filter((item) => Number(item.quantity) - Number(item.reservedQuantity) <= 0)) add({ category: 'STOCK_UNAVAILABLE', severity: 'WARNING', title: `${x.product.productNo} 可用库存耗尽`, description: `${x.product.name}${x.sku ? ` / ${x.sku.skuCode}` : ''} · ${x.warehouse.name}/${x.location.code}`, sourceType: 'INVENTORY_BALANCE', sourceId: x.id, sourceNo: x.product.productNo, metadata: { availableQuantity: Number(x.quantity) - Number(x.reservedQuantity) } });

    for (const candidate of candidates) {
      await this.prisma.alertEvent.upsert({
        where: { organizationId_fingerprint: { organizationId: org, fingerprint: candidate.fingerprint } },
        update: { category: candidate.category, severity: candidate.severity, title: candidate.title, description: candidate.description, sourceType: candidate.sourceType, sourceId: candidate.sourceId, sourceNo: candidate.sourceNo, dueAt: candidate.dueAt, detectedAt: now, metadata: candidate.metadata },
        create: { organizationId: org, ...candidate, detectedAt: now },
      });
    }
    const scannerCategories = ['ORDER_DELIVERY_OVERDUE', 'PURCHASE_ARRIVAL_OVERDUE', 'WORK_ORDER_OVERDUE', 'RECEIVABLE_OVERDUE', 'PAYABLE_OVERDUE', 'SHIPMENT_OVERDUE', 'INSTALLATION_OVERDUE', 'AFTER_SALES_STALE', 'STOCK_UNAVAILABLE'];
    const resolved = await this.prisma.alertEvent.updateMany({ where: { organizationId: org, category: { in: scannerCategories }, status: { in: ['OPEN', 'ACKNOWLEDGED'] }, ...(candidates.length ? { fingerprint: { notIn: candidates.map((item) => item.fingerprint) } } : {}) }, data: { status: 'RESOLVED', resolvedAt: now } });
    return { detected: candidates.length, autoResolved: resolved.count, scannedAt: now };
  }

  async updateAlert(user: AuthUser, id: string, input: UpdateAlertDto) {
    const current = await this.prisma.alertEvent.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!current) throw new NotFoundException('预警不存在');
    const allowed: Record<AlertStatus, AlertStatus[]> = { OPEN: ['ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'], ACKNOWLEDGED: ['RESOLVED', 'DISMISSED'], RESOLVED: [], DISMISSED: [] };
    if (!allowed[current.status].includes(input.status)) throw new BadRequestException(`不能从 ${current.status} 变更为 ${input.status}`);
    return this.prisma.alertEvent.update({ where: { id }, data: { status: input.status, acknowledgedAt: input.status === 'ACKNOWLEDGED' ? new Date() : undefined, acknowledgedById: input.status === 'ACKNOWLEDGED' ? user.sub : undefined, resolvedAt: input.status === 'RESOLVED' || input.status === 'DISMISSED' ? new Date() : undefined, resolvedById: input.status === 'RESOLVED' || input.status === 'DISMISSED' ? user.sub : undefined } });
  }

  private taskScope(user: AuthUser): Prisma.WorkTaskWhereInput { return this.isBroad(user) ? {} : { OR: [{ assigneeId: user.sub }, { createdById: user.sub }] }; }
  private isBroad(user: AuthUser) { return user.dataScopes.includes('ALL') || user.dataScopes.includes('COMPANY'); }
  private async assertAssignee(organizationId: string, assigneeId: string) { const user = await this.prisma.user.findFirst({ where: { id: assigneeId, organizationId, status: 'ACTIVE' } }); if (!user) throw new BadRequestException('任务执行人不存在或已停用'); }
  private assertTaskTransition(from: WorkTaskStatus, to: WorkTaskStatus) { const allowed: Record<WorkTaskStatus, WorkTaskStatus[]> = { TODO: ['IN_PROGRESS', 'DONE', 'CANCELLED'], IN_PROGRESS: ['TODO', 'DONE', 'CANCELLED'], DONE: ['IN_PROGRESS'], CANCELLED: ['TODO'] }; if (!allowed[from].includes(to)) throw new BadRequestException(`不能从 ${from} 变更为 ${to}`); }
  private async nextNumber(tx: Prisma.TransactionClient, organizationId: string, code: string) { await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${organizationId}:${code}`}))`; const rule = await tx.businessNumberRule.findUnique({ where: { organizationId_code: { organizationId, code } } }); if (!rule || !rule.active) throw new NotFoundException(`业务编号规则 ${code} 不存在`); const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).replaceAll('-', ''); const number = rule.currentDate === date ? rule.currentValue + 1 : 1; await tx.businessNumberRule.update({ where: { id: rule.id }, data: { currentDate: date, currentValue: number } }); return `${rule.prefix}-${date}-${String(number).padStart(rule.sequenceLength, '0')}`; }
}
