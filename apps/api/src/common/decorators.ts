import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Role } from './domain-types';
import { AuthUser } from './auth-user';

export const IS_PUBLIC_KEY = 'isPublic';
export const MIN_ROLE_KEY = 'minRole';
export const PERMISSION_KEY = 'permission';

/** Rota sem autenticação. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Exige papel igual ou superior na hierarquia. */
export const MinRole = (role: Role) => SetMetadata(MIN_ROLE_KEY, role);

/** Exige uma permissão granular validada no servidor. */
export const RequirePermission = (module: string, action: string) => SetMetadata(PERMISSION_KEY, { module, action });

/** Injeta o usuário autenticado no handler. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<{ user: AuthUser }>().user;
});
