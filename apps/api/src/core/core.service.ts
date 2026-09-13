import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { AuthUser } from '../auth/auth.types';
import type { CreateAttachmentDto, ListQueryDto } from './dto/core.dto';
import { PrismaService } from '../prisma/prisma.service';
import { FieldPermissionService } from '../common/field-permission.service';

@Injectable()
export class CoreService {
  constructor(private readonly prisma: PrismaService, private readonly fields: FieldPermissionService) {}

  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', service: 'ffai-api', database: 'connected', timestamp: new Date().toISOString() };
  }

  async profile(user: AuthUser) {
    const detail = await this.prisma.user.findUnique({ where: { id: user.sub }, select: {
      id: true, username: true, employeeNo: true, displayName: true, phone: true, email: true, jobTitle: true, remark: true, status: true, mustChangePassword: true, passwordChangedAt: true, lastLoginAt: true,
      organization: { select: { id: true, code: true, name: true } },
      roles: { select: { role: { select: { id: true, code: true, name: true, dataScope: true } } } },
      orgUnits: { select: { isPrimary: true, orgUnit: { select: { id: true, code: true, name: true, path: true } } } },
    } });
    return { ...detail, roleCodes: user.roleCodes, permissions: user.permissions, dataScopes: user.dataScopes, tokenVersion: user.tokenVersion };
  }

  async menus(user: AuthUser) {
    return this.prisma.menu.findMany({
      where: { visible: true, roles: { some: { role: { users: { some: { userId: user.sub } } } } } },
      orderBy: [{ sort: 'asc' }, { name: 'asc' }], select: { id: true, parentId: true, code: true, name: true, type: true, path: true, icon: true, permissionCode: true },
    });
  }

  async users(user: AuthUser, query: ListQueryDto) {
    const filters: any[] = [{ organizationId: user.organizationId }];
    if (query.keyword) filters.push({ OR: [{ username: { contains: query.keyword, mode: 'insensitive' } }, { displayName: { contains: query.keyword, mode: 'insensitive' } }, { employeeNo: { contains: query.keyword, mode: 'insensitive' } }] });
    if (query.status) filters.push({ status: query.status });
    if (query.roleId) filters.push({ roles: { some: { roleId: query.roleId } } });
    if (query.orgUnitId) filters.push({ orgUnits: { some: { orgUnitId: query.orgUnitId } } });
    if (!user.dataScopes.includes('ALL') && !user.dataScopes.includes('COMPANY')) {
      const memberships = await this.prisma.userOrgUnit.findMany({ where: { userId: user.sub }, select: { orgUnit: { select: { id: true, path: true } } } });
      const scopes: any[] = [{ id: user.sub }];
      if (user.dataScopes.includes('DEPARTMENT_AND_CHILDREN') && memberships.length) scopes.push({ orgUnits: { some: { orgUnit: { OR: memberships.map((m) => ({ path: { startsWith: m.orgUnit.path } })) } } } });
      if (user.dataScopes.includes('DEPARTMENT') && memberships.length) scopes.push({ orgUnits: { some: { orgUnitId: { in: memberships.map((m) => m.orgUnit.id) } } } });
      if (user.dataScopes.includes('CUSTOM')) {
        const custom = await this.prisma.roleDataScopeOrgUnit.findMany({ where: { role: { active: true, users: { some: { userId: user.sub } } } }, select: { orgUnitId: true } });
        if (custom.length) scopes.push({ orgUnits: { some: { orgUnitId: { in: custom.map((x) => x.orgUnitId) } } } });
      }
      filters.push({ OR: scopes });
    }
    const where: any = { AND: filters };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: { createdAt: 'desc' }, select: {
        id: true, username: true, employeeNo: true, displayName: true, phone: true, email: true, jobTitle: true, remark: true,
        status: true, mustChangePassword: true, lastLoginAt: true, createdAt: true,
        roles: { select: { role: { select: { id: true, code: true, name: true, active: true, dataScope: true } } } },
        orgUnits: { select: { isPrimary: true, orgUnit: { select: { id: true, code: true, name: true, path: true, type: true, active: true } } } },
      } }), this.prisma.user.count({ where }),
    ]);
    return { items: await Promise.all(items.map((item) => this.fields.redact(user, 'system.user', item, ['employeeNo', 'phone', 'email', 'remark']))), total, page: query.page, pageSize: query.pageSize };
  }

  roles(user: AuthUser) {
    return this.prisma.role.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: 'asc' }, include: {
      _count: { select: { users: true, permissions: true } }, fieldPermissions: true,
    } });
  }

  organization(user: AuthUser) {
    return this.prisma.orgUnit.findMany({ where: { organizationId: user.organizationId }, orderBy: [{ path: 'asc' }, { sort: 'asc' }] });
  }

  dictionaries(user: AuthUser): Promise<unknown> {
    return this.prisma.dictionary.findMany({ where: { organizationId: user.organizationId }, include: { items: { orderBy: { sort: 'asc' } } }, orderBy: { code: 'asc' } });
  }

  auditLogs(user: AuthUser, query: ListQueryDto): Promise<unknown> {
    return this.prisma.auditLog.findMany({ where: { organizationId: user.organizationId }, take: query.pageSize, skip: (query.page - 1) * query.pageSize, orderBy: { createdAt: 'desc' }, include: { actor: { select: { username: true, displayName: true } } } });
  }

  async nextNumber(user: AuthUser, code: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${user.organizationId}:${code}`}))`;
      const rule = await tx.businessNumberRule.findUnique({ where: { organizationId_code: { organizationId: user.organizationId, code } } });
      if (!rule || !rule.active) throw new NotFoundException('业务编号规则不存在或已停用');
      const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).replaceAll('-', '');
      const next = rule.currentDate === date ? rule.currentValue + 1 : 1;
      await tx.businessNumberRule.update({ where: { id: rule.id }, data: { currentDate: date, currentValue: next } });
      return { code, number: `${rule.prefix}-${date}-${String(next).padStart(rule.sequenceLength, '0')}` };
    });
  }

  async registerAttachment(user: AuthUser, input: CreateAttachmentDto) {
    const safeName = input.originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return this.prisma.attachment.create({ data: {
      organizationId: user.organizationId, uploadedById: user.sub, originalName: input.originalName,
      contentType: input.contentType, size: BigInt(input.size), businessType: input.businessType,
      businessId: input.businessId, storageKey: `${user.organizationId}/${new Date().getUTCFullYear()}/${randomUUID()}-${safeName}`,
    }, select: { id: true, storageKey: true, status: true, createdAt: true } });
  }
}
