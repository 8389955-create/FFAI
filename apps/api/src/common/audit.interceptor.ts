import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { tap } from 'rxjs/operators';
import type { Observable } from 'rxjs';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ method: string; url: string; ip?: string; headers: Record<string, string | undefined>; user?: AuthUser }>();
    const action = ({ POST: 'CREATE', PUT: 'UPDATE', PATCH: 'UPDATE', DELETE: 'DELETE' } as const)[request.method as 'POST'];
    return next.handle().pipe(tap(() => {
      if (!action || !request.user || request.url.includes('/auth/')) return;
      void this.prisma.auditLog.create({ data: {
        organizationId: request.user.organizationId, actorId: request.user.sub, action,
        resource: request.url.split('?')[0].slice(0, 80), ip: request.ip,
        requestId: request.headers['x-request-id'], userAgent: request.headers['user-agent'],
      } }).catch(() => undefined);
    }));
  }
}

