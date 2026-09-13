import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '../auth.types';
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthUser => context.switchToHttp().getRequest<{ user: AuthUser }>().user);

