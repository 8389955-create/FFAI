import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { LoginDto } from './dto/login.dto';
import type { AuthUser } from './auth.types';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async login(input: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { username: input.username, organization: { code: input.organizationCode }, status: 'ACTIVE' },
      include: { roles: { where: { role: { active: true } }, include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });
    if (!user || !(await compare(input.password, user.passwordHash))) throw new UnauthorizedException('企业、账号或密码不正确');
    const principal = this.toPrincipal(user);
    const accessToken = await this.jwt.signAsync(principal, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: (process.env.JWT_ACCESS_TTL ?? '15m') as never });
    const refreshId = randomUUID();
    const refreshToken = await this.jwt.signAsync({ sub: user.id, jti: refreshId, tokenVersion: user.tokenVersion }, { secret: process.env.JWT_REFRESH_SECRET, expiresIn: (process.env.JWT_REFRESH_TTL ?? '7d') as never });
    const decoded = this.jwt.decode<{ exp: number }>(refreshToken);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
      this.prisma.refreshToken.create({ data: { userId: user.id, tokenHash: this.digest(refreshToken), expiresAt: new Date(decoded.exp * 1000) } }),
      this.prisma.auditLog.create({ data: { organizationId: user.organizationId, actorId: user.id, action: 'LOGIN', resource: 'auth' } }),
    ]);
    return { accessToken, refreshToken, user: principal };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; tokenVersion: number };
    try { payload = await this.jwt.verifyAsync(refreshToken, { secret: process.env.JWT_REFRESH_SECRET }); }
    catch { throw new UnauthorizedException('刷新令牌无效或已过期'); }
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: this.digest(refreshToken) } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) throw new UnauthorizedException('刷新令牌已失效');
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { roles: { where: { role: { active: true } }, include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });
    if (!user || user.status !== 'ACTIVE' || user.tokenVersion !== payload.tokenVersion) throw new UnauthorizedException('用户会话已失效');
    const principal = this.toPrincipal(user);
    return { accessToken: await this.jwt.signAsync(principal, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: (process.env.JWT_ACCESS_TTL ?? '15m') as never }), user: principal };
  }

  async logout(refreshToken?: string) {
    if (refreshToken) await this.prisma.refreshToken.updateMany({ where: { tokenHash: this.digest(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
    return { success: true };
  }

  private digest(value: string) { return createHash('sha256').update(value).digest('hex'); }
  private toPrincipal(user: any): AuthUser {
    const roles = user.roles.map((item: any) => item.role);
    return {
      sub: user.id, organizationId: user.organizationId, username: user.username, displayName: user.displayName,
      roleCodes: roles.map((role: any) => role.code),
      permissions: [...new Set<string>(roles.flatMap((role: any) => role.permissions.map((item: any) => item.permission.code)))],
      dataScopes: [...new Set<string>(roles.map((role: any) => role.dataScope))], tokenVersion: user.tokenVersion,
      mustChangePassword: user.mustChangePassword,
    };
  }
}
