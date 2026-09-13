import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@ffai/database';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { AssignWorkOrderDto, CreateProductionOrderDto, CreateWorkReportDto, MesListQueryDto } from './dto/mes.dto';

@Injectable()
export class MesService {
  constructor(private readonly prisma: PrismaService) {}

  async availableOrders(user: AuthUser) {
    return this.prisma.salesOrder.findMany({
      where: { organizationId: user.organizationId, status: { in: ['CONFIRMED', 'PLANNING'] }, productionOrder: null, ...this.salesScope(user), items: { some: { productionRequired: true } } },
      orderBy: { confirmedAt: 'asc' }, include: { customer: { select: { name: true } }, project: { select: { name: true } }, _count: { select: { items: true } } },
    });
  }

  async list(user: AuthUser, query: MesListQueryDto) {
    const scope = this.scope(user);
    const where: Prisma.ProductionOrderWhereInput = { organizationId: user.organizationId, ...scope,
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword ? { OR: [{ productionOrderNo: { contains: query.keyword, mode: 'insensitive' } }, { salesOrder: { OR: [{ orderNo: { contains: query.keyword, mode: 'insensitive' } }, { title: { contains: query.keyword, mode: 'insensitive' } }] } }] } : {}),
    };
    const [items, total, groups] = await this.prisma.$transaction([
      this.prisma.productionOrder.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }], include: { salesOrder: { select: { id: true, orderNo: true, title: true, expectedDeliveryAt: true, customer: { select: { name: true } } } }, _count: { select: { items: true, workOrders: true } } } }),
      this.prisma.productionOrder.count({ where }), this.prisma.productionOrder.groupBy({ by: ['status'], where: { organizationId: user.organizationId, ...scope }, _count: true, orderBy: { status: 'asc' } }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize, summary: Object.fromEntries(groups.map((group) => [group.status, group._count])) };
  }

  async detail(user: AuthUser, id: string) {
    const production = await this.prisma.productionOrder.findFirst({
      where: { id, organizationId: user.organizationId, ...this.scope(user) },
      include: {
        salesOrder: { include: { customer: { select: { name: true, customerNo: true } }, project: { select: { name: true, projectNo: true } } } },
        items: { orderBy: { sort: 'asc' }, include: {
          product: { select: { productNo: true, name: true } },
          workOrders: { orderBy: { sequence: 'asc' }, include: { assignedTo: { select: { id: true, displayName: true, username: true } }, reports: { orderBy: { createdAt: 'desc' }, take: 10, include: { reporter: { select: { displayName: true } } } } } },
        } },
      },
    });
    if (!production) throw new NotFoundException('生产订单不存在或不在当前数据范围内');
    return production;
  }

  async create(user: AuthUser, input: CreateProductionOrderDto) {
    const salesOrder = await this.prisma.salesOrder.findFirst({ where: { id: input.salesOrderId, organizationId: user.organizationId, status: { in: ['CONFIRMED', 'PLANNING'] }, ...this.salesScope(user) }, include: { items: { where: { productionRequired: true } } } });
    if (!salesOrder?.items.length) throw new BadRequestException('销售订单不可投产或没有生产项');
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`sales-production:${salesOrder.id}`}))`;
      const exists = await tx.productionOrder.findUnique({ where: { salesOrderId: salesOrder.id } });
      if (exists) return exists;
      const productionOrderNo = await this.nextNumber(tx, user.organizationId, 'PRODUCTION_ORDER');
      return tx.productionOrder.create({ data: {
        organizationId: user.organizationId, productionOrderNo, salesOrderId: salesOrder.id, priority: input.priority,
        plannedStartAt: input.plannedStartAt ? new Date(input.plannedStartAt) : undefined, plannedEndAt: input.plannedEndAt ? new Date(input.plannedEndAt) : undefined,
        notes: input.notes, createdById: user.sub, items: { create: salesOrder.items.map((item) => ({ salesOrderItemId: item.id, productId: item.productId, skuId: item.skuId, description: item.description, specification: item.specification, plannedQuantity: item.quantity, unit: item.unit, sort: item.sort })) },
      } });
    });
  }

  async release(user: AuthUser, id: string) {
    const production = await this.detail(user, id);
    if (production.status !== 'PLANNED') throw new BadRequestException('只有计划态生产订单可以下达');
    const route = [['CUTTING', '开料', '开料区'], ['WOODWORK', '木工', '木工区'], ['SANDING', '打磨', '打磨区'], ['FINISHING', '涂装', '涂装区']] as const;
    await this.prisma.$transaction(async (tx) => {
      for (const item of production.items) for (let index = 0; index < route.length; index++) {
        const [operationCode, operationName, workstation] = route[index];
        const workOrderNo = await this.nextNumber(tx, user.organizationId, 'WORK_ORDER');
        await tx.workOrder.create({ data: { organizationId: user.organizationId, workOrderNo, productionOrderId: id, productionOrderItemId: item.id, operationCode, operationName, sequence: (index + 1) * 10, status: index === 0 ? 'READY' : 'PENDING', workstation, plannedQuantity: item.plannedQuantity, createdById: user.sub } });
      }
      await tx.productionOrder.update({ where: { id }, data: { status: 'RELEASED' } });
      await tx.salesOrder.update({ where: { id: production.salesOrderId }, data: { status: 'PLANNING' } });
    });
    return this.detail(user, id);
  }

  async assign(user: AuthUser, productionId: string, workOrderId: string, input: AssignWorkOrderDto) {
    const production = await this.detail(user, productionId);
    if (!production.items.some((item) => item.workOrders.some((work) => work.id === workOrderId))) throw new NotFoundException('工单不存在');
    if (input.assignedToId) {
      const worker = await this.prisma.user.findFirst({ where: { id: input.assignedToId, organizationId: user.organizationId, status: 'ACTIVE' } });
      if (!worker) throw new BadRequestException('派工人员不存在或已停用');
    }
    return this.prisma.workOrder.update({ where: { id: workOrderId }, data: input });
  }

  async report(user: AuthUser, productionId: string, workOrderId: string, input: CreateWorkReportDto) {
    const production = await this.detail(user, productionId);
    const work = production.items.flatMap((item) => item.workOrders).find((item) => item.id === workOrderId);
    if (!work) throw new NotFoundException('工单不存在');
    const broad = user.dataScopes.includes('ALL') || user.dataScopes.includes('COMPANY') || user.permissions.includes('mes.workorder.manage');
    if (!broad && work.assignedToId !== user.sub) throw new ForbiddenException('只能对分配给自己的工单报工');
    if (input.type === 'START' && !['READY', 'PAUSED'].includes(work.status)) throw new BadRequestException('当前工单不能开工');
    if (['PROGRESS', 'COMPLETE', 'ISSUE'].includes(input.type) && work.status !== 'IN_PROGRESS') throw new BadRequestException('工单尚未开工');
    const good = new Prisma.Decimal(input.goodQuantity ?? 0), scrap = new Prisma.Decimal(input.scrapQuantity ?? 0);
    const nextGood = work.completedQuantity.add(good), nextScrap = work.scrapQuantity.add(scrap);
    if (nextGood.gt(work.plannedQuantity)) throw new BadRequestException('累计良品数量不能超过计划数量');
    if (input.type === 'COMPLETE' && nextGood.lt(work.plannedQuantity)) throw new BadRequestException('完工报工的累计良品数量必须达到计划数量');
    await this.prisma.$transaction(async (tx) => {
      await tx.workReport.create({ data: { organizationId: user.organizationId, workOrderId, type: input.type, goodQuantity: good, scrapQuantity: scrap, minutesSpent: input.minutesSpent, note: input.note, reporterId: user.sub } });
      const status = input.type === 'START' ? 'IN_PROGRESS' : input.type === 'ISSUE' ? 'PAUSED' : input.type === 'COMPLETE' ? 'COMPLETED' : work.status;
      await tx.workOrder.update({ where: { id: workOrderId }, data: { status, completedQuantity: nextGood, scrapQuantity: nextScrap, ...(input.type === 'START' ? { actualStartAt: work.actualStartAt ?? new Date() } : {}), ...(input.type === 'COMPLETE' ? { actualEndAt: new Date() } : {}) } });
      if (input.type === 'START') {
        await tx.productionOrder.update({ where: { id: productionId }, data: { status: 'IN_PROGRESS', actualStartAt: production.actualStartAt ?? new Date() } });
        await tx.salesOrder.update({ where: { id: production.salesOrderId }, data: { status: 'IN_PRODUCTION' } });
      }
      if (input.type === 'COMPLETE') {
        const next = await tx.workOrder.findFirst({ where: { productionOrderItemId: work.productionOrderItemId, sequence: { gt: work.sequence }, status: 'PENDING' }, orderBy: { sequence: 'asc' } });
        if (next) await tx.workOrder.update({ where: { id: next.id }, data: { status: 'READY' } });
        const unfinished = await tx.workOrder.count({ where: { productionOrderId: productionId, id: { not: workOrderId }, status: { not: 'COMPLETED' } } });
        if (unfinished === 0) {
          for (const item of production.items) await tx.productionOrderItem.update({ where: { id: item.id }, data: { completedQuantity: item.plannedQuantity } });
          await tx.productionOrder.update({ where: { id: productionId }, data: { status: 'COMPLETED', actualEndAt: new Date() } });
          await tx.salesOrder.update({ where: { id: production.salesOrderId }, data: { status: 'READY_TO_SHIP' } });
        }
      }
    });
    return this.detail(user, productionId);
  }

  private scope(user: AuthUser): Prisma.ProductionOrderWhereInput {
    if (user.dataScopes.includes('ALL') || user.dataScopes.includes('COMPANY')) return {};
    return { OR: [{ salesOrder: { OR: [{ ownerId: user.sub }, { project: { members: { some: { userId: user.sub } } } }] } }, { workOrders: { some: { assignedToId: user.sub } } }] };
  }
  private salesScope(user: AuthUser): Prisma.SalesOrderWhereInput {
    if (user.dataScopes.includes('ALL') || user.dataScopes.includes('COMPANY')) return {};
    return { OR: [{ ownerId: user.sub }, { project: { members: { some: { userId: user.sub } } } }] };
  }
  private async nextNumber(tx: Prisma.TransactionClient, organizationId: string, code: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${organizationId}:${code}`}))`;
    const rule = await tx.businessNumberRule.findUnique({ where: { organizationId_code: { organizationId, code } } });
    if (!rule?.active) throw new NotFoundException(`业务编号规则 ${code} 不存在`);
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).replaceAll('-', '');
    const next = rule.currentDate === date ? rule.currentValue + 1 : 1;
    await tx.businessNumberRule.update({ where: { id: rule.id }, data: { currentDate: date, currentValue: next } });
    return `${rule.prefix}-${date}-${String(next).padStart(rule.sequenceLength, '0')}`;
  }
}
