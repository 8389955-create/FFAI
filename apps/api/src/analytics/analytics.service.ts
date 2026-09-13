import { Injectable, NotFoundException } from '@nestjs/common';
import { AlertSeverity, Prisma } from '@ffai/database';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { InsightQueryDto, TrendQueryDto } from './dto/analytics.dto';

type InsightCandidate = { fingerprint: string; type: string; severity: AlertSeverity; title: string; summary: string; recommendation: string; evidence: Prisma.InputJsonValue };

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  dashboard(user: AuthUser) { return this.collectMetrics(user); }

  async trends(user: AuthUser, query: TrendQueryDto) {
    const from = new Date(); from.setUTCDate(from.getUTCDate() - query.days);
    return this.prisma.analyticsSnapshot.findMany({ where: { organizationId: user.organizationId, granularity: 'DAILY', snapshotDate: { gte: from } }, select: { id: true, snapshotDate: true, metrics: true, createdAt: true }, orderBy: { snapshotDate: 'asc' } });
  }

  async snapshot(user: AuthUser) {
    const metrics = await this.collectMetrics(user);
    const now = new Date(); const snapshotDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return this.prisma.analyticsSnapshot.upsert({ where: { organizationId_snapshotDate_granularity: { organizationId: user.organizationId, snapshotDate, granularity: 'DAILY' } }, update: { metrics: metrics as unknown as Prisma.InputJsonValue, generatedById: user.sub }, create: { organizationId: user.organizationId, snapshotDate, granularity: 'DAILY', metrics: metrics as unknown as Prisma.InputJsonValue, generatedById: user.sub } });
  }

  insights(user: AuthUser, query: InsightQueryDto) {
    return this.prisma.aiInsight.findMany({ where: { organizationId: user.organizationId, status: query.status }, include: { generatedBy: { select: { displayName: true } } }, orderBy: [{ status: 'asc' }, { severity: 'desc' }, { generatedAt: 'desc' }] });
  }

  async generateInsights(user: AuthUser) {
    const metrics = await this.collectMetrics(user);
    const candidates: InsightCandidate[] = [];
    const salesTotal = metrics.sales.totalAmount;
    const outstanding = metrics.finance.receivableOutstanding;
    if (salesTotal > 0) {
      const exposure = outstanding / salesTotal;
      candidates.push({ fingerprint: 'CASH_COLLECTION_EXPOSURE', type: 'FINANCE', severity: exposure >= .3 ? 'CRITICAL' : exposure >= .1 ? 'WARNING' : 'INFO', title: '销售回款敞口分析', summary: `当前应收余额占有效订单金额的 ${(exposure * 100).toFixed(1)}%。`, recommendation: exposure >= .3 ? '优先跟进大额逾期应收，并将新订单发货与回款节点联动。' : '维持周度回款复盘，重点关注临近账期的客户。', evidence: { salesTotal, outstanding, exposure } });
      const closed = (metrics.sales.statuses.INSTALLED ?? 0) + (metrics.sales.statuses.COMPLETED ?? 0);
      const rate = closed / metrics.sales.count;
      candidates.push({ fingerprint: 'ORDER_DELIVERY_CLOSURE', type: 'FULFILLMENT', severity: rate < .5 ? 'WARNING' : 'INFO', title: '订单交付闭环率', summary: `${metrics.sales.count} 个有效订单中，${closed} 个已安装或完成，闭环率 ${(rate * 100).toFixed(1)}%。`, recommendation: rate < .5 ? '检查生产、备货和安装三处等待时间，优先推进已过承诺交期订单。' : '交付闭环保持稳定，可继续缩短签收至安装的平均等待时间。', evidence: { totalOrders: metrics.sales.count, closedOrders: closed, closureRate: rate } });
    }
    if (metrics.operations.unavailableStock > 0) candidates.push({ fingerprint: 'INVENTORY_AVAILABILITY', type: 'INVENTORY', severity: 'WARNING', title: '存在零可用库存', summary: `${metrics.operations.unavailableStock} 个库存结存已无可用量。`, recommendation: '结合未发订单和采购在途量核查补货优先级，避免订单发货中断。', evidence: { unavailableStock: metrics.operations.unavailableStock, stockBalances: metrics.operations.stockBalances } });
    if (metrics.execution.overdueTasks > 0 || metrics.execution.criticalAlerts > 0) candidates.push({ fingerprint: 'EXECUTION_RISK', type: 'EXECUTION', severity: metrics.execution.criticalAlerts > 0 ? 'CRITICAL' : 'WARNING', title: '执行风险需要处理', summary: `当前有 ${metrics.execution.overdueTasks} 个超期任务、${metrics.execution.criticalAlerts} 个严重预警。`, recommendation: '由责任人确认根因、承诺完成时间，并在任务中心持续关闭风险。', evidence: { overdueTasks: metrics.execution.overdueTasks, criticalAlerts: metrics.execution.criticalAlerts } });
    if (metrics.fulfillment.openAfterSales > 0) candidates.push({ fingerprint: 'AFTER_SALES_BACKLOG', type: 'CUSTOMER', severity: metrics.fulfillment.urgentAfterSales > 0 ? 'CRITICAL' : 'WARNING', title: '售后待办积压', summary: `有 ${metrics.fulfillment.openAfterSales} 个售后未闭环，其中紧急 ${metrics.fulfillment.urgentAfterSales} 个。`, recommendation: '按紧急程度和客户等级安排责任人，解决后沉淀问题类型与返修原因。', evidence: { openAfterSales: metrics.fulfillment.openAfterSales, urgentAfterSales: metrics.fulfillment.urgentAfterSales } });
    const now = new Date();
    for (const candidate of candidates) await this.prisma.aiInsight.upsert({ where: { organizationId_fingerprint: { organizationId: user.organizationId, fingerprint: candidate.fingerprint } }, update: { type: candidate.type, severity: candidate.severity, title: candidate.title, summary: candidate.summary, recommendation: candidate.recommendation, evidence: candidate.evidence, generatedAt: now, generatedById: user.sub }, create: { organizationId: user.organizationId, ...candidate, generatedAt: now, generatedById: user.sub } });
    const archived = await this.prisma.aiInsight.updateMany({ where: { organizationId: user.organizationId, status: 'ACTIVE', ...(candidates.length ? { fingerprint: { notIn: candidates.map((item) => item.fingerprint) } } : {}) }, data: { status: 'ARCHIVED' } });
    return { generated: candidates.length, archived: archived.count, generatedAt: now };
  }

  async dismissInsight(user: AuthUser, id: string) {
    const insight = await this.prisma.aiInsight.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!insight) throw new NotFoundException('智能洞察不存在');
    return this.prisma.aiInsight.update({ where: { id }, data: { status: 'DISMISSED' } });
  }

  private async collectMetrics(user: AuthUser) {
    const org = user.organizationId; const now = new Date(); const broad = this.isBroad(user);
    const orderScope: Prisma.SalesOrderWhereInput = broad ? {} : { ownerId: user.sub };
    const projectScope: Prisma.ProjectWhereInput = broad ? {} : { OR: [{ ownerId: user.sub }, { members: { some: { userId: user.sub } } }] };
    const taskScope: Prisma.WorkTaskWhereInput = broad ? {} : { OR: [{ assigneeId: user.sub }, { createdById: user.sub }] };
    const [customers, leads, wonLeads, projects, quotationValue, orders, orderGroups, activeProduction, overdueWorkOrders, balances, receivables, payables, receipts, payments, openShipments, openInstallations, openAfterSales, urgentAfterSales, openTasks, overdueTasks, activeAlerts, criticalAlerts] = await Promise.all([
      this.prisma.customer.count({ where: { organizationId: org, deletedAt: null, ...(broad ? {} : { ownerId: user.sub }) } }),
      this.prisma.lead.count({ where: { organizationId: org, deletedAt: null, ...(broad ? {} : { ownerId: user.sub }) } }),
      this.prisma.lead.count({ where: { organizationId: org, deletedAt: null, status: 'WON', ...(broad ? {} : { ownerId: user.sub }) } }),
      this.prisma.project.count({ where: { organizationId: org, deletedAt: null, ...projectScope } }),
      this.prisma.quotation.aggregate({ where: { organizationId: org, status: { notIn: ['DRAFT', 'REJECTED', 'EXPIRED'] }, ...(broad ? {} : { ownerId: user.sub }) }, _sum: { totalAmount: true }, _count: true }),
      this.prisma.salesOrder.aggregate({ where: { organizationId: org, status: { notIn: ['DRAFT', 'CANCELLED'] }, ...orderScope }, _sum: { totalAmount: true, paidAmount: true }, _count: true }),
      this.prisma.salesOrder.groupBy({ by: ['status'], where: { organizationId: org, status: { notIn: ['DRAFT', 'CANCELLED'] }, ...orderScope }, orderBy: { status: 'asc' }, _count: true }),
      this.prisma.productionOrder.count({ where: { organizationId: org, status: { in: ['RELEASED', 'IN_PROGRESS', 'PAUSED'] }, salesOrder: orderScope } }),
      this.prisma.workOrder.count({ where: { organizationId: org, plannedEndAt: { lt: now }, status: { notIn: ['COMPLETED', 'CANCELLED'] }, productionOrder: { salesOrder: orderScope } } }),
      this.prisma.inventoryBalance.findMany({ where: { organizationId: org, ...(broad ? {} : { id: '__not_visible__' }) }, select: { quantity: true, reservedQuantity: true } }),
      this.prisma.accountReceivable.aggregate({ where: { organizationId: org, status: { not: 'VOID' }, salesOrder: orderScope }, _sum: { totalAmount: true, paidAmount: true }, _count: true }),
      this.prisma.accountPayable.aggregate({ where: { organizationId: org, status: { not: 'VOID' }, ...(broad ? {} : { id: '__not_visible__' }) }, _sum: { totalAmount: true, paidAmount: true }, _count: true }),
      this.prisma.customerReceipt.aggregate({ where: { organizationId: org, receivable: { salesOrder: orderScope } }, _sum: { amount: true } }),
      this.prisma.supplierPayment.aggregate({ where: { organizationId: org, ...(broad ? {} : { id: '__not_visible__' }) }, _sum: { amount: true } }),
      this.prisma.shipment.count({ where: { organizationId: org, status: { notIn: ['DELIVERED', 'CANCELLED'] }, salesOrder: orderScope } }),
      this.prisma.installationTask.count({ where: { organizationId: org, status: { notIn: ['COMPLETED', 'CANCELLED'] }, salesOrder: orderScope } }),
      this.prisma.afterSalesTicket.count({ where: { organizationId: org, status: { notIn: ['RESOLVED', 'CLOSED', 'CANCELLED'] }, salesOrder: orderScope } }),
      this.prisma.afterSalesTicket.count({ where: { organizationId: org, priority: 'URGENT', status: { notIn: ['RESOLVED', 'CLOSED', 'CANCELLED'] }, salesOrder: orderScope } }),
      this.prisma.workTask.count({ where: { organizationId: org, ...taskScope, status: { notIn: ['DONE', 'CANCELLED'] } } }),
      this.prisma.workTask.count({ where: { organizationId: org, ...taskScope, status: { notIn: ['DONE', 'CANCELLED'] }, dueAt: { lt: now } } }),
      this.prisma.alertEvent.count({ where: { organizationId: org, status: { in: ['OPEN', 'ACKNOWLEDGED'] }, ...(broad ? {} : { id: '__not_visible__' }) } }),
      this.prisma.alertEvent.count({ where: { organizationId: org, status: { in: ['OPEN', 'ACKNOWLEDGED'] }, severity: 'CRITICAL', ...(broad ? {} : { id: '__not_visible__' }) } }),
    ]);
    const statuses = Object.fromEntries(orderGroups.map((item) => [item.status, item._count]));
    const receivableTotal = Number(receivables._sum.totalAmount ?? 0), receivablePaid = Number(receivables._sum.paidAmount ?? 0), payableTotal = Number(payables._sum.totalAmount ?? 0), payablePaid = Number(payables._sum.paidAmount ?? 0);
    const unavailableStock = balances.filter((item) => Number(item.quantity) - Number(item.reservedQuantity) <= 0).length;
    return {
      generatedAt: now,
      customer: { customers, leads, wonLeads, leadWinRate: leads ? wonLeads / leads : 0, projects },
      sales: { count: orders._count, totalAmount: Number(orders._sum.totalAmount ?? 0), paidAmount: Number(orders._sum.paidAmount ?? 0), quotationCount: quotationValue._count, quotationValue: Number(quotationValue._sum.totalAmount ?? 0), statuses },
      operations: { activeProduction, overdueWorkOrders, stockBalances: balances.length, unavailableStock },
      finance: { receivableCount: receivables._count, receivableOutstanding: receivableTotal - receivablePaid, payableCount: payables._count, payableOutstanding: payableTotal - payablePaid, cashIn: Number(receipts._sum.amount ?? 0), cashOut: Number(payments._sum.amount ?? 0) },
      fulfillment: { openShipments, openInstallations, openAfterSales, urgentAfterSales },
      execution: { openTasks, overdueTasks, activeAlerts, criticalAlerts },
    };
  }

  private isBroad(user: AuthUser) { return user.dataScopes.includes('ALL') || user.dataScopes.includes('COMPANY'); }
}
