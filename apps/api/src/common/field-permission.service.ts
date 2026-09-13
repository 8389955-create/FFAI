import { ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FieldPermissionService {
  constructor(private readonly prisma: PrismaService) {}

  private async rules(user: AuthUser, resource: string, fields: string[]) {
    if (user.roleCodes.includes('OWNER')) return new Map(fields.map((field) => [field, { canRead: true, canWrite: true }]));
    const rows = await this.prisma.fieldPermission.findMany({ where: {
      resource, field: { in: fields }, role: { active: true, users: { some: { userId: user.sub } } },
    }, select: { field: true, canRead: true, canWrite: true } });
    const result = new Map<string, { canRead: boolean; canWrite: boolean }>();
    for (const field of fields) {
      const matches = rows.filter((row) => row.field === field);
      // Existing resources remain compatible until a role explicitly configures a field.
      result.set(field, matches.length ? { canRead: matches.some((x) => x.canRead), canWrite: matches.some((x) => x.canWrite) } : { canRead: true, canWrite: true });
    }
    return result;
  }

  async canRead(user: AuthUser, resource: string, field: string) { return (await this.rules(user, resource, [field])).get(field)!.canRead; }
  async canWrite(user: AuthUser, resource: string, field: string) { return (await this.rules(user, resource, [field])).get(field)!.canWrite; }

  async assertWritable(user: AuthUser, resource: string, fields: string[]) {
    if (!fields.length) return;
    const access = await this.rules(user, resource, fields);
    const denied = fields.find((field) => !access.get(field)?.canWrite);
    if (denied) throw new ForbiddenException(`当前角色无权修改字段 ${resource}.${denied}`);
  }

  async redact<T>(user: AuthUser, resource: string, value: T, fields: string[]): Promise<T> {
    const access = await this.rules(user, resource, fields);
    const result = { ...(value as Record<string, unknown>) };
    for (const field of fields) if (!access.get(field)?.canRead) delete result[field];
    return result as T;
  }
}
