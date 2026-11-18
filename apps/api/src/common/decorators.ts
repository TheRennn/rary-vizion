import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Role } from './domain-types';
import { AuthUser } from './auth-user';

export const IS_PUBLIC_KEY = 'isPublic';
export const MIN_ROLE_KEY = 'minRole';

/** Rota sem autenticação. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Exige papel igual ou superior na hierarquia. */
export const MinRole = (role: Role) => SetMetadata(MIN_ROLE_KEY, role);

/** Injeta o usuário autenticado no handler. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<{ user: AuthUser }>().user;
});
