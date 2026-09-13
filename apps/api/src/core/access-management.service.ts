import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { ChangePasswordDto, CreateRoleDto, CreateUserDto, ResetPasswordDto, UpdateProfileDto, UpdateRoleAccessDto, UpdateUserDto } from './dto/access-management.dto';
import { FieldPermissionService } from '../common/field-permission.service';

const userSelect = {
  id: true, username: true, employeeNo: true, displayName: true, phone: true, email: true, jobTitle: true, remark: true,
  status: true, mustChangePassword: true, passwordChangedAt: true, lastLoginAt: true, createdAt: true, updatedAt: true,
  roles: { select: { role: { select: { id: true, code: true, name: true, dataScope: true } } }, orderBy: { role: { name: 'asc' as const } } },
  orgUnits: { select: { isPrimary: true, orgUnit: { select: { id: true, code: true, name: true, path: true, type: true } } }, orderBy: { orgUnit: { path: 'asc' as const } } },
};
const FIELD_CATALOG = [
  { resource: 'system.user', field: 'employeeNo', label: '用户工号' }, { resource: 'system.user', field: 'phone', label: '用户手机号' },
  { resource: 'system.user', field: 'email', label: '用户邮箱' }, { resource: 'system.user', field: 'remark', label: '用户备注' },
  { resource: 'pim.product', field: 'factoryPrice', label: '产品工厂价' }, { resource: 'finance.payroll', field: 'baseAmount', label: '工资基本薪资' },
  { resource: 'finance.payroll', field: 'bonusAmount', label: '工资奖金' }, { resource: 'finance.payroll', field: 'deductionAmount', label: '工资扣款' },
  { resource: 'finance.payroll', field: 'netAmount', label: '工资实发金额' },
] as const;

@Injectable()
export class AccessManagementService {
  constructor(private readonly prisma: PrismaService, private readonly fields: FieldPermissionService) {}

  private clean(value?: string) { const cleaned = value?.trim(); return cleaned || null; }
  private databaseError(error: unknown): never {
    const code = (error as { code?: string }).code;
    if (code === 'P2002') throw new ConflictException('账号、工号、手机号或邮箱已被使用');
    throw error;
  }
  private async assertAccessIds(organizationId: string, roleIds: string[], orgUnitIds: string[], primaryOrgUnitId: string) {
    const uniqueRoles = [...new Set(roleIds)];
    const uniqueUnits = [...new Set(orgUnitIds)];
    if (!uniqueUnits.includes(primaryOrgUnitId)) throw new BadRequestException('主组织必须包含在所属组织中');
    const [roleCount, unitCount] = await this.prisma.$transaction([
      this.prisma.role.count({ where: { organizationId, id: { in: uniqueRoles }, active: true } }),
      this.prisma.orgUnit.count({ where: { organizationId, id: { in: uniqueUnits }, active: true } }),
    ]);
    if (roleCount !== uniqueRoles.length) throw new BadRequestException('包含无效或已停用的角色');
    if (unitCount !== uniqueUnits.length) throw new BadRequestException('包含无效或已停用的组织单元');
    return { roleIds: uniqueRoles, orgUnitIds: uniqueUnits };
  }
  private async targetScope(user: AuthUser) {
    if (user.dataScopes.includes('ALL') || user.dataScopes.includes('COMPANY')) return {};
    const memberships = await this.prisma.userOrgUnit.findMany({ where: { userId: user.sub }, select: { orgUnit: { select: { id: true, path: true } } } });
    const or: any[] = [{ id: user.sub }];
    if (user.dataScopes.includes('DEPARTMENT_AND_CHILDREN') && memberships.length) or.push({ orgUnits: { some: { orgUnit: { OR: memberships.map((x) => ({ path: { startsWith: x.orgUnit.path } })) } } } });
    if (user.dataScopes.includes('DEPARTMENT') && memberships.length) or.push({ orgUnits: { some: { orgUnitId: { in: memberships.map((x) => x.orgUnit.id) } } } });
    if (user.dataScopes.includes('CUSTOM')) {
      const custom = await this.prisma.roleDataScopeOrgUnit.findMany({ where: { role: { active: true, users: { some: { userId: user.sub } } } }, select: { orgUnitId: true } });
      if (custom.length) or.push({ orgUnits: { some: { orgUnitId: { in: custom.map((x) => x.orgUnitId) } } } });
    }
    return { OR: or };
  }
  private async ensureUser(user: AuthUser, id: string) {
    const target = await this.prisma.user.findFirst({ where: { id, organizationId: user.organizationId, ...(await this.targetScope(user)) }, select: { id: true, status: true, roles: { select: { role: { select: { code: true } } } } } });
    if (!target) throw new NotFoundException('用户不存在');
    return this.fields.redact(user, 'system.user', target, ['employeeNo', 'phone', 'email', 'remark']);
  }
  private async assertNoOwnerEscalation(user: AuthUser, roleIds: string[]) {
    if (user.roleCodes.includes('OWNER')) return;
    const ownerSelected = await this.prisma.role.count({ where: { organizationId: user.organizationId, id: { in: roleIds }, code: 'OWNER' } });
    if (ownerSelected) throw new ForbiddenException('只有老板角色可以授予老板权限');
  }

  async detail(user: AuthUser, id: string) {
    const target = await this.prisma.user.findFirst({ where: { id, organizationId: user.organizationId, ...(await this.targetScope(user)) }, select: userSelect });
    if (!target) throw new NotFoundException('用户不存在');
    return target;
  }

  async createUser(user: AuthUser, input: CreateUserDto) {
    await this.fields.assertWritable(user, 'system.user', ['employeeNo', 'phone', 'email', 'remark'].filter((field) => input[field as keyof CreateUserDto] !== undefined));
    const ids = await this.assertAccessIds(user.organizationId, input.roleIds, input.orgUnitIds, input.primaryOrgUnitId);
    await this.assertNoOwnerEscalation(user, ids.roleIds);
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const record = await tx.user.create({ data: {
          organizationId: user.organizationId, username: input.username.trim().toLowerCase(), employeeNo: this.clean(input.employeeNo),
          displayName: input.displayName.trim(), phone: this.clean(input.phone), email: this.clean(input.email)?.toLowerCase(),
          jobTitle: this.clean(input.jobTitle), remark: this.clean(input.remark), passwordHash: await hash(input.password, 12),
          status: input.status ?? 'ACTIVE', mustChangePassword: input.mustChangePassword ?? true,
        } });
        await tx.userRole.createMany({ data: ids.roleIds.map((roleId) => ({ userId: record.id, roleId })) });
        await tx.userOrgUnit.createMany({ data: ids.orgUnitIds.map((orgUnitId) => ({ userId: record.id, orgUnitId, isPrimary: orgUnitId === input.primaryOrgUnitId })) });
        return record;
      });
      return this.detail(user, created.id);
    } catch (error) { this.databaseError(error); }
  }

  async updateUser(user: AuthUser, id: string, input: UpdateUserDto) {
    await this.fields.assertWritable(user, 'system.user', ['employeeNo', 'phone', 'email', 'remark'].filter((field) => input[field as keyof UpdateUserDto] !== undefined));
    const target = await this.ensureUser(user, id);
    if (id === user.sub && input.status && input.status !== 'ACTIVE') throw new BadRequestException('不能停用或锁定当前登录账号');
    if (target.roles.some((item) => item.role.code === 'OWNER') && !user.roleCodes.includes('OWNER')) throw new ForbiddenException('只有老板角色可以修改老板账号');
    const current = await this.prisma.user.findUniqueOrThrow({ where: { id }, select: { orgUnits: { select: { orgUnitId: true, isPrimary: true } } } });
    const roleIds = input.roleIds;
    const orgUnitIds = input.orgUnitIds;
    const primary = input.primaryOrgUnitId ?? current.orgUnits.find((x) => x.isPrimary)?.orgUnitId ?? orgUnitIds?.[0];
    if ((roleIds && !orgUnitIds) || (!roleIds && orgUnitIds)) throw new BadRequestException('调整权限时必须同时提交角色和组织信息');
    if (roleIds && orgUnitIds && primary) { await this.assertAccessIds(user.organizationId, roleIds, orgUnitIds, primary); await this.assertNoOwnerEscalation(user, roleIds); }
    if (target.roles.some((item) => item.role.code === 'OWNER') && ((roleIds && !(await this.prisma.role.count({ where: { organizationId: user.organizationId, id: { in: roleIds }, code: 'OWNER' } }))) || (input.status && input.status !== 'ACTIVE'))) {
      const otherOwners = await this.prisma.user.count({ where: { organizationId: user.organizationId, id: { not: id }, status: 'ACTIVE', roles: { some: { role: { code: 'OWNER', active: true } } } } });
      if (!otherOwners) throw new BadRequestException('必须至少保留一个正常状态的老板账号');
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id }, data: {
          ...(input.employeeNo !== undefined ? { employeeNo: this.clean(input.employeeNo) } : {}),
          ...(input.displayName !== undefined ? { displayName: input.displayName.trim() } : {}),
          ...(input.phone !== undefined ? { phone: this.clean(input.phone) } : {}),
          ...(input.email !== undefined ? { email: this.clean(input.email)?.toLowerCase() } : {}),
          ...(input.jobTitle !== undefined ? { jobTitle: this.clean(input.jobTitle) } : {}),
          ...(input.remark !== undefined ? { remark: this.clean(input.remark) } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}), tokenVersion: { increment: 1 },
        } });
        if (roleIds && orgUnitIds && primary) {
          await tx.userRole.deleteMany({ where: { userId: id } });
          await tx.userOrgUnit.deleteMany({ where: { userId: id } });
          await tx.userRole.createMany({ data: [...new Set(roleIds)].map((roleId) => ({ userId: id, roleId })) });
          await tx.userOrgUnit.createMany({ data: [...new Set(orgUnitIds)].map((orgUnitId) => ({ userId: id, orgUnitId, isPrimary: orgUnitId === primary })) });
        }
        await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      });
      return this.detail(user, id);
    } catch (error) { this.databaseError(error); }
  }

  async resetPassword(user: AuthUser, id: string, input: ResetPasswordDto) {
    const target = await this.ensureUser(user, id);
    if (target.roles.some((item) => item.role.code === 'OWNER') && !user.roleCodes.includes('OWNER')) throw new ForbiddenException('只有老板角色可以重置老板账号密码');
    const passwordHash = await hash(input.newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { passwordHash, mustChangePassword: input.mustChangePassword ?? true, passwordChangedAt: new Date(), tokenVersion: { increment: 1 } } }),
      this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return { success: true };
  }

  async updateProfile(user: AuthUser, input: UpdateProfileDto) {
    try {
      await this.prisma.user.update({ where: { id: user.sub }, data: { displayName: input.displayName.trim(), phone: this.clean(input.phone), email: this.clean(input.email)?.toLowerCase() } });
      return { success: true };
    } catch (error) { this.databaseError(error); }
  }

  async changePassword(user: AuthUser, input: ChangePasswordDto) {
    if (input.currentPassword === input.newPassword) throw new BadRequestException('新密码不能与当前密码相同');
    const account = await this.prisma.user.findUnique({ where: { id: user.sub }, select: { passwordHash: true } });
    if (!account || !(await compare(input.currentPassword, account.passwordHash))) throw new UnauthorizedException('当前密码不正确');
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.sub }, data: { passwordHash: await hash(input.newPassword, 12), mustChangePassword: false, passwordChangedAt: new Date(), tokenVersion: { increment: 1 } } }),
      this.prisma.refreshToken.updateMany({ where: { userId: user.sub, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return { success: true, reloginRequired: true };
  }

  options(user: AuthUser) {
    return Promise.all([
      this.prisma.role.findMany({ where: { organizationId: user.organizationId }, select: { id: true, code: true, name: true, active: true, dataScope: true }, orderBy: { name: 'asc' } }),
      this.prisma.orgUnit.findMany({ where: { organizationId: user.organizationId }, select: { id: true, code: true, name: true, path: true, type: true, active: true }, orderBy: [{ path: 'asc' }, { sort: 'asc' }] }),
      this.prisma.permission.findMany({ orderBy: [{ resource: 'asc' }, { action: 'asc' }] }),
      this.prisma.menu.findMany({ orderBy: [{ sort: 'asc' }, { name: 'asc' }] }),
    ]).then(([roles, orgUnits, permissions, menus]) => ({ roles, orgUnits, permissions, menus, fieldCatalog: FIELD_CATALOG }));
  }

  async roleDetail(user: AuthUser, id: string) {
    const role = await this.prisma.role.findFirst({ where: { id, organizationId: user.organizationId }, include: {
      permissions: { select: { permission: true } }, menus: { select: { menu: true } },
      customScopeUnits: { select: { orgUnit: { select: { id: true, code: true, name: true, path: true } } } }, fieldPermissions: true,
      _count: { select: { users: true } },
    } });
    if (!role) throw new NotFoundException('角色不存在');
    return role;
  }

  async createRole(user: AuthUser, input: CreateRoleDto) {
    try {
      return await this.prisma.role.create({ data: {
        organizationId: user.organizationId, code: input.code, name: input.name.trim(), description: this.clean(input.description), dataScope: input.dataScope,
        fieldPermissions: { create: FIELD_CATALOG.map(({ resource, field }) => ({ resource, field, canRead: false, canWrite: false })) },
      } });
    } catch (error) { this.databaseError(error); }
  }

  async updateRole(user: AuthUser, id: string, input: UpdateRoleAccessDto) {
    const role = await this.roleDetail(user, id);
    if (role.code === 'OWNER' && !user.roleCodes.includes('OWNER')) throw new ForbiddenException('只有老板角色可以修改老板权限');
    if (role.code === 'OWNER' && (!input.active || input.dataScope !== 'ALL')) throw new BadRequestException('老板角色必须保持启用并拥有全部数据范围');
    const permissionIds = [...new Set(input.permissionIds)], menuIds = [...new Set(input.menuIds)], unitIds = [...new Set(input.customOrgUnitIds)];
    const submittedFieldKeys = new Set(input.fieldPermissions.map((x) => `${x.resource}.${x.field}`));
    if (submittedFieldKeys.size !== FIELD_CATALOG.length || !FIELD_CATALOG.every((x) => submittedFieldKeys.has(`${x.resource}.${x.field}`))) throw new BadRequestException('字段权限配置必须包含完整字段目录');
    const [selectedPermissions, selectedMenus, unitCount] = await this.prisma.$transaction([
      this.prisma.permission.findMany({ where: { id: { in: permissionIds } }, select: { id: true, code: true } }), this.prisma.menu.findMany({ where: { id: { in: menuIds } }, select: { id: true, permissionCode: true } }),
      this.prisma.orgUnit.count({ where: { organizationId: user.organizationId, id: { in: unitIds } } }),
    ]);
    if (selectedPermissions.length !== permissionIds.length || selectedMenus.length !== menuIds.length || unitCount !== unitIds.length) throw new BadRequestException('权限、菜单或自定义组织范围包含无效项目');
    const codes = new Set(selectedPermissions.map((x) => x.code));
    const missingMenuPermission = selectedMenus.find((x) => x.permissionCode && !codes.has(x.permissionCode));
    if (missingMenuPermission) throw new BadRequestException('可视模块必须同时勾选其对应的查看权限');
    if (input.dataScope === 'CUSTOM' && !unitIds.length) throw new BadRequestException('自定义数据范围至少选择一个组织单元');
    await this.prisma.$transaction(async (tx) => {
      await tx.role.update({ where: { id }, data: { name: input.name.trim(), description: this.clean(input.description), active: input.active, dataScope: input.dataScope } });
      await Promise.all([
        tx.rolePermission.deleteMany({ where: { roleId: id } }), tx.roleMenu.deleteMany({ where: { roleId: id } }),
        tx.roleDataScopeOrgUnit.deleteMany({ where: { roleId: id } }), tx.fieldPermission.deleteMany({ where: { roleId: id } }),
      ]);
      if (permissionIds.length) await tx.rolePermission.createMany({ data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })) });
      if (menuIds.length) await tx.roleMenu.createMany({ data: menuIds.map((menuId) => ({ roleId: id, menuId })) });
      if (input.dataScope === 'CUSTOM') await tx.roleDataScopeOrgUnit.createMany({ data: unitIds.map((orgUnitId) => ({ roleId: id, orgUnitId })) });
      if (input.fieldPermissions.length) await tx.fieldPermission.createMany({ data: input.fieldPermissions.map((field) => ({ roleId: id, ...field, canWrite: field.canRead && field.canWrite })) });
      await tx.user.updateMany({ where: { roles: { some: { roleId: id } } }, data: { tokenVersion: { increment: 1 } } });
      await tx.refreshToken.updateMany({ where: { user: { roles: { some: { roleId: id } } }, revokedAt: null }, data: { revokedAt: new Date() } });
    });
    return this.roleDetail(user, id);
  }
}
