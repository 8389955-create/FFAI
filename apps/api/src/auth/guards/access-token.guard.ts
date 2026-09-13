import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthUser } from '../auth.types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly jwt: JwtService, private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<Request & { user: AuthUser }>();
    const token = request.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new UnauthorizedException('缺少访问令牌');
    try {
      request.user = await this.jwt.verifyAsync<AuthUser>(token, { secret: process.env.JWT_ACCESS_SECRET });
      const account = await this.prisma.user.findUnique({ where: { id: request.user.sub }, select: { organizationId: true, status: true, tokenVersion: true } });
      if (!account || account.organizationId !== request.user.organizationId || account.status !== 'ACTIVE' || account.tokenVersion !== request.user.tokenVersion) throw new UnauthorizedException('账号状态或权限已变更，请重新登录');
      return true;
    } catch {
      throw new UnauthorizedException('访问令牌无效或已过期');
    }
  }
}
