import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@ffai/database';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateActivityDto, CreateContactDto, CreateCustomerDto, CreateLeadDto, CrmListQueryDto, UpdateCustomerDto, UpdateLeadDto } from './dto/crm.dto';

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  async listCustomers(user: AuthUser, query: CrmListQueryDto) {
    const scope = await this.scope(user);
    const where: Prisma.CustomerWhereInput = {
      organizationId: user.organizationId, deletedAt: null, ...scope,
      ...(query.status ? { status: query.status as never } : {}),
      ...(query.keyword ? { OR: [
        { customerNo: { contains: query.keyword, mode: 'insensitive' } }, { name: { contains: query.keyword, mode: 'insensitive' } },
        { phone: { contains: query.keyword } }, { contacts: { some: { name: { contains: query.keyword, mode: 'insensitive' } } } },
      ] } : {}),
    };
    const [items, total, statusGroups] = await this.prisma.$transaction([
      this.prisma.customer.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: { updatedAt: 'desc' }, include: {
        owner: { select: { id: true, displayName: true } }, orgUnit: { select: { id: true, name: true } },
        contacts: { where: { isPrimary: true }, take: 1 }, _count: { select: { contacts: true, activities: true } },
      } }), this.prisma.customer.count({ where }),
      this.prisma.customer.groupBy({ by: ['status'], where: { organizationId: user.organizationId, deletedAt: null, ...scope }, orderBy: { status: 'asc' }, _count: true }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize, summary: Object.fromEntries(statusGroups.map((g) => [g.status, g._count])) };
  }

  async customer(user: AuthUser, id: string) {
    const scope = await this.scope(user);
    const customer = await this.prisma.customer.findFirst({ where: { id, organizationId: user.organizationId, deletedAt: null, ...scope }, include: {
      owner: { select: { id: true, displayName: true } }, orgUnit: { select: { id: true, name: true } }, contacts: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
      activities: { orderBy: { occurredAt: 'desc' }, include: { createdBy: { select: { displayName: true } } } },
    } });
    if (!customer) throw new NotFoundException('客户不存在或不在当前数据范围内');
    return customer;
  }

  async createCustomer(user: AuthUser, input: CreateCustomerDto) {
    const assignment = await this.assignment(user, input.ownerId, input.orgUnitId);
    return this.prisma.$transaction(async (tx) => {
      const customerNo = await this.nextNumber(tx, user.organizationId, 'CUSTOMER');
      return tx.customer.create({ data: { ...input, ...assignment, customerNo, organizationId: user.organizationId, createdById: user.sub, ownerId: assignment.ownerId, orgUnitId: assignment.orgUnitId } });
    });
  }

  async updateCustomer(user: AuthUser, id: string, input: UpdateCustomerDto) {
    await this.customer(user, id);
    const { ownerId, orgUnitId, ...data } = input;
    const assignment = ownerId || orgUnitId ? await this.assignment(user, ownerId, orgUnitId) : {};
    return this.prisma.customer.update({ where: { id }, data: { ...data, ...assignment } });
  }

  async addContact(user: AuthUser, customerId: string, input: CreateContactDto) {
    await this.customer(user, customerId);
    return this.prisma.$transaction(async (tx) => {
      if (input.isPrimary) await tx.customerContact.updateMany({ where: { customerId }, data: { isPrimary: false } });
      return tx.customerContact.create({ data: { ...input, customerId } });
    });
  }

  async addCustomerActivity(user: AuthUser, customerId: string, input: CreateActivityDto) {
    await this.customer(user, customerId);
    return this.prisma.crmActivity.create({ data: {
      organizationId: user.organizationId, customerId, createdById: user.sub, type: input.type, content: input.content,
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined, nextFollowUpAt: input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : undefined,
    } });
  }

  async listLeads(user: AuthUser, query: CrmListQueryDto) {
    const scope = await this.scope(user);
    const where: Prisma.LeadWhereInput = {
      organizationId: user.organizationId, deletedAt: null, ...scope,
      ...(query.status ? { status: query.status as never } : {}),
      ...(query.keyword ? { OR: [{ leadNo: { contains: query.keyword, mode: 'insensitive' } }, { name: { contains: query.keyword, mode: 'insensitive' } }, { contactName: { contains: query.keyword, mode: 'insensitive' } }, { phone: { contains: query.keyword } }] } : {}),
    };
    const [items, total, statusGroups] = await this.prisma.$transaction([
      this.prisma.lead.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: [{ nextFollowUpAt: 'asc' }, { updatedAt: 'desc' }], include: {
        owner: { select: { id: true, displayName: true } }, orgUnit: { select: { id: true, name: true } }, _count: { select: { activities: true } },
      } }), this.prisma.lead.count({ where }),
      this.prisma.lead.groupBy({ by: ['status'], where: { organizationId: user.organizationId, deletedAt: null, ...scope }, orderBy: { status: 'asc' }, _count: true }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize, summary: Object.fromEntries(statusGroups.map((g) => [g.status, g._count])) };
  }

  async lead(user: AuthUser, id: string) {
    const scope = await this.scope(user);
    const lead = await this.prisma.lead.findFirst({ where: { id, organizationId: user.organizationId, deletedAt: null, ...scope }, include: {
      owner: { select: { id: true, displayName: true } }, orgUnit: { select: { id: true, name: true } },
      activities: { orderBy: { occurredAt: 'desc' }, include: { createdBy: { select: { displayName: true } } } }, convertedCustomer: true,
    } });
    if (!lead) throw new NotFoundException('线索不存在或不在当前数据范围内');
    return lead;
  }

  async createLead(user: AuthUser, input: CreateLeadDto) {
    const assignment = await this.assignment(user, input.ownerId, input.orgUnitId);
    return this.prisma.$transaction(async (tx) => {
      const leadNo = await this.nextNumber(tx, user.organizationId, 'LEAD');
      const { nextFollowUpAt, ...data } = input;
      return tx.lead.create({ data: { ...data, ...assignment, nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt) : undefined, leadNo, organizationId: user.organizationId, createdById: user.sub } });
    });
  }

  async updateLead(user: AuthUser, id: string, input: UpdateLeadDto) {
    await this.lead(user, id);
    const { ownerId, orgUnitId, nextFollowUpAt, ...data } = input;
    const assignment = ownerId || orgUnitId ? await this.assignment(user, ownerId, orgUnitId) : {};
    return this.prisma.lead.update({ where: { id }, data: { ...data, ...assignment, ...(nextFollowUpAt ? { nextFollowUpAt: new Date(nextFollowUpAt) } : {}) } });
  }

  async addLeadActivity(user: AuthUser, leadId: string, input: CreateActivityDto) {
    await this.lead(user, leadId);
    return this.prisma.crmActivity.create({ data: {
      organizationId: user.organizationId, leadId, createdById: user.sub, type: input.type, content: input.content,
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined, nextFollowUpAt: input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : undefined,
    } });
  }

  async convertLead(user: AuthUser, id: string) {
    const lead = await this.lead(user, id);
    if (lead.convertedCustomerId) throw new BadRequestException('该线索已经转为客户');
    return this.prisma.$transaction(async (tx) => {
      const customerNo = await this.nextNumber(tx, user.organizationId, 'CUSTOMER');
      const customer = await tx.customer.create({ data: {
        organizationId: user.organizationId, customerNo, name: lead.name, phone: lead.phone, email: lead.email, source: lead.source,
        status: 'ACTIVE', ownerId: lead.ownerId, orgUnitId: lead.orgUnitId, createdById: user.sub,
      } });
      await tx.lead.update({ where: { id }, data: { status: 'WON', convertedCustomerId: customer.id } });
      await tx.crmActivity.create({ data: { organizationId: user.organizationId, leadId: id, customerId: customer.id, createdById: user.sub, type: 'NOTE', content: `线索已转为客户 ${customer.customerNo}` } });
      return customer;
    });
  }

  private async assignment(user: AuthUser, requestedOwnerId?: string, requestedOrgUnitId?: string) {
    const broad = user.dataScopes.includes('ALL') || user.dataScopes.includes('COMPANY');
    const membership = await this.prisma.userOrgUnit.findFirst({ where: { userId: user.sub }, orderBy: { isPrimary: 'desc' } });
    if (!membership) throw new BadRequestException('当前用户尚未配置组织归属');
    if (!broad && (requestedOwnerId && requestedOwnerId !== user.sub)) throw new ForbiddenException('当前数据范围不能分配给其他负责人');
    const ownerId = broad && requestedOwnerId ? requestedOwnerId : user.sub;
    const orgUnitId = broad && requestedOrgUnitId ? requestedOrgUnitId : membership.orgUnitId;
    const valid = await this.prisma.user.findFirst({ where: { id: ownerId, organizationId: user.organizationId, status: 'ACTIVE' } });
    const unit = await this.prisma.orgUnit.findFirst({ where: { id: orgUnitId, organizationId: user.organizationId, active: true } });
    if (!valid || !unit) throw new BadRequestException('负责人或组织单元无效');
    return { ownerId, orgUnitId };
  }

  private async scope(user: AuthUser): Promise<Record<string, unknown>> {
    if (user.dataScopes.includes('ALL') || user.dataScopes.includes('COMPANY')) return {};
    const conditions: Record<string, unknown>[] = [];
    if (user.dataScopes.includes('SELF')) conditions.push({ ownerId: user.sub });
    const memberships = await this.prisma.userOrgUnit.findMany({ where: { userId: user.sub }, select: { orgUnit: { select: { id: true, path: true } } } });
    if (user.dataScopes.includes('DEPARTMENT')) conditions.push({ orgUnitId: { in: memberships.map((m) => m.orgUnit.id) } });
    if (user.dataScopes.includes('DEPARTMENT_AND_CHILDREN')) conditions.push({ orgUnit: { OR: memberships.map((m) => ({ path: { startsWith: m.orgUnit.path } })) } });
    if (user.dataScopes.includes('CUSTOM')) {
      const units = await this.prisma.roleDataScopeOrgUnit.findMany({ where: { role: { code: { in: user.roleCodes }, organizationId: user.organizationId } }, select: { orgUnitId: true } });
      conditions.push({ orgUnitId: { in: units.map((u) => u.orgUnitId) } });
    }
    return conditions.length ? { OR: conditions } : { ownerId: user.sub };
  }

  private async nextNumber(tx: Prisma.TransactionClient, organizationId: string, code: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${organizationId}:${code}`}))`;
    const rule = await tx.businessNumberRule.findUnique({ where: { organizationId_code: { organizationId, code } } });
    if (!rule || !rule.active) throw new NotFoundException(`业务编号规则 ${code} 不存在`);
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).replaceAll('-', '');
    const next = rule.currentDate === date ? rule.currentValue + 1 : 1;
    await tx.businessNumberRule.update({ where: { id: rule.id }, data: { currentDate: date, currentValue: next } });
    return `${rule.prefix}-${date}-${String(next).padStart(rule.sequenceLength, '0')}`;
  }
}
