import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@ffai/database';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { AddProjectMemberDto, CreateDesignVersionDto, CreateProjectDto, CreateProjectSpaceDto, ProjectListQueryDto, ReviewDesignVersionDto, UpdateProjectDto } from './dto/project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser, query: ProjectListQueryDto) {
    const scope = await this.scope(user);
    const where: Prisma.ProjectWhereInput = { organizationId: user.organizationId, deletedAt: null, ...scope,
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword ? { OR: [{ projectNo: { contains: query.keyword, mode: 'insensitive' } }, { name: { contains: query.keyword, mode: 'insensitive' } }, { customer: { name: { contains: query.keyword, mode: 'insensitive' } } }] } : {}),
    };
    const [items, total, groups] = await this.prisma.$transaction([
      this.prisma.project.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: { updatedAt: 'desc' }, include: {
        customer: { select: { id: true, customerNo: true, name: true } }, owner: { select: { id: true, displayName: true } },
        orgUnit: { select: { id: true, name: true } }, _count: { select: { spaces: true, members: true, designVersions: true } },
      } }), this.prisma.project.count({ where }),
      this.prisma.project.groupBy({ by: ['status'], where: { organizationId: user.organizationId, deletedAt: null, ...scope }, orderBy: { status: 'asc' }, _count: true }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize, summary: Object.fromEntries(groups.map((group) => [group.status, group._count])) };
  }

  async detail(user: AuthUser, id: string) {
    const scope = await this.scope(user);
    const project = await this.prisma.project.findFirst({ where: { id, organizationId: user.organizationId, deletedAt: null, ...scope }, include: {
      customer: { select: { id: true, customerNo: true, name: true, phone: true } }, owner: { select: { id: true, displayName: true } }, orgUnit: { select: { id: true, name: true } },
      members: { orderBy: { joinedAt: 'asc' }, include: { user: { select: { id: true, displayName: true, username: true } } } },
      spaces: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] },
      designVersions: { orderBy: { versionNo: 'desc' }, include: { createdBy: { select: { displayName: true } }, reviewedBy: { select: { displayName: true } }, attachment: { select: { id: true, originalName: true, status: true } } } },
    } });
    if (!project) throw new NotFoundException('项目不存在或不在当前数据范围内');
    return project;
  }

  async create(user: AuthUser, input: CreateProjectDto) {
    await this.assertCustomerAccess(user, input.customerId);
    const assignment = await this.assignment(user, input.ownerId, input.orgUnitId);
    return this.prisma.$transaction(async (tx) => {
      const projectNo = await this.nextNumber(tx, user.organizationId, 'PROJECT');
      const { expectedDeliveryAt, ownerId: _owner, orgUnitId: _unit, ...data } = input;
      const project = await tx.project.create({ data: { ...data, ...assignment, projectNo, organizationId: user.organizationId, createdById: user.sub, expectedDeliveryAt: expectedDeliveryAt ? new Date(expectedDeliveryAt) : undefined } });
      await tx.projectMember.create({ data: { projectId: project.id, userId: assignment.ownerId, role: 'MANAGER' } });
      return project;
    });
  }

  async update(user: AuthUser, id: string, input: UpdateProjectDto) {
    await this.detail(user, id);
    if (input.customerId) await this.assertCustomerAccess(user, input.customerId);
    const { expectedDeliveryAt, ownerId, orgUnitId, ...data } = input;
    const assignment = ownerId || orgUnitId ? await this.assignment(user, ownerId, orgUnitId) : {};
    return this.prisma.project.update({ where: { id }, data: { ...data, ...assignment, ...(expectedDeliveryAt ? { expectedDeliveryAt: new Date(expectedDeliveryAt) } : {}) } });
  }

  async addSpace(user: AuthUser, projectId: string, input: CreateProjectSpaceDto) {
    await this.detail(user, projectId);
    return this.prisma.projectSpace.create({ data: { ...input, projectId } });
  }

  async addMember(user: AuthUser, projectId: string, input: AddProjectMemberDto) {
    await this.detail(user, projectId);
    const member = await this.prisma.user.findFirst({ where: { id: input.userId, organizationId: user.organizationId, status: 'ACTIVE' } });
    if (!member) throw new BadRequestException('项目成员不存在或已停用');
    return this.prisma.projectMember.upsert({ where: { projectId_userId: { projectId, userId: input.userId } }, update: { role: input.role }, create: { projectId, userId: input.userId, role: input.role } });
  }

  async createDesignVersion(user: AuthUser, projectId: string, input: CreateDesignVersionDto) {
    await this.detail(user, projectId);
    if (input.attachmentId) {
      const attachment = await this.prisma.attachment.findFirst({ where: { id: input.attachmentId, organizationId: user.organizationId, status: { not: 'DELETED' } } });
      if (!attachment) throw new BadRequestException('附件不存在或不可用');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`design:${projectId}`}))`;
      const aggregate = await tx.designVersion.aggregate({ where: { projectId }, _max: { versionNo: true } });
      return tx.designVersion.create({ data: { ...input, projectId, versionNo: (aggregate._max.versionNo ?? 0) + 1, createdById: user.sub } });
    });
  }

  async reviewDesignVersion(user: AuthUser, projectId: string, versionId: string, input: ReviewDesignVersionDto) {
    await this.detail(user, projectId);
    const version = await this.prisma.designVersion.findFirst({ where: { id: versionId, projectId } });
    if (!version) throw new NotFoundException('设计版本不存在');
    const reviewed = ['APPROVED', 'REJECTED'].includes(input.status);
    return this.prisma.designVersion.update({ where: { id: versionId }, data: { status: input.status, reviewNote: input.reviewNote, reviewedById: reviewed ? user.sub : null, reviewedAt: reviewed ? new Date() : null } });
  }

  private async scope(user: AuthUser): Promise<Record<string, unknown>> {
    if (user.dataScopes.includes('ALL') || user.dataScopes.includes('COMPANY')) return {};
    const conditions: Record<string, unknown>[] = [{ members: { some: { userId: user.sub } } }];
    if (user.dataScopes.includes('SELF')) conditions.push({ ownerId: user.sub });
    const memberships = await this.prisma.userOrgUnit.findMany({ where: { userId: user.sub }, select: { orgUnit: { select: { id: true, path: true } } } });
    if (user.dataScopes.includes('DEPARTMENT')) conditions.push({ orgUnitId: { in: memberships.map((item) => item.orgUnit.id) } });
    if (user.dataScopes.includes('DEPARTMENT_AND_CHILDREN')) conditions.push({ orgUnit: { OR: memberships.map((item) => ({ path: { startsWith: item.orgUnit.path } })) } });
    if (user.dataScopes.includes('CUSTOM')) {
      const units = await this.prisma.roleDataScopeOrgUnit.findMany({ where: { role: { code: { in: user.roleCodes }, organizationId: user.organizationId } }, select: { orgUnitId: true } });
      conditions.push({ orgUnitId: { in: units.map((item) => item.orgUnitId) } });
    }
    return { OR: conditions };
  }

  private async assignment(user: AuthUser, requestedOwnerId?: string, requestedOrgUnitId?: string) {
    const broad = user.dataScopes.includes('ALL') || user.dataScopes.includes('COMPANY');
    const membership = await this.prisma.userOrgUnit.findFirst({ where: { userId: user.sub }, orderBy: { isPrimary: 'desc' } });
    if (!membership) throw new BadRequestException('当前用户尚未配置组织归属');
    if (!broad && requestedOwnerId && requestedOwnerId !== user.sub) throw new ForbiddenException('当前数据范围不能分配给其他负责人');
    const ownerId = broad && requestedOwnerId ? requestedOwnerId : user.sub;
    const orgUnitId = broad && requestedOrgUnitId ? requestedOrgUnitId : membership.orgUnitId;
    const [owner, unit] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: ownerId, organizationId: user.organizationId, status: 'ACTIVE' } }),
      this.prisma.orgUnit.findFirst({ where: { id: orgUnitId, organizationId: user.organizationId, active: true } }),
    ]);
    if (!owner || !unit) throw new BadRequestException('负责人或组织单元无效');
    return { ownerId, orgUnitId };
  }

  private async assertCustomerAccess(user: AuthUser, customerId: string) {
    const broad = user.dataScopes.includes('ALL') || user.dataScopes.includes('COMPANY');
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, organizationId: user.organizationId, deletedAt: null, ...(broad ? {} : { ownerId: user.sub }) } });
    if (!customer) throw new ForbiddenException('客户不存在或不在当前数据范围内');
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

