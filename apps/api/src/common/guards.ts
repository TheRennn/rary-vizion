import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from './domain-types';
import { AuthUser } from './auth-user';
import { IS_PUBLIC_KEY, MIN_ROLE_KEY, PERMISSION_KEY } from './decorators';
import { hasMinRole } from './roles';
import { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { readSessionCookie } from '../auth/session-cookie';
import { PermissionsService } from '../auth/permissions.service';
import { PermissionAction, PermissionModule } from './permissions';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = readSessionCookie(request);
    if (!token) throw new UnauthorizedException('Sessão obrigatória');
    request.user = await this.auth.authenticate(token);
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const minRole = this.reflector.getAllAndOverride<Role | undefined>(MIN_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!minRole) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!user || !hasMinRole(user.role, minRole)) {
      throw new ForbiddenException('Permissão insuficiente para esta ação');
    }
    return true;
  }
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly permissions: PermissionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<{ module: PermissionModule; action: PermissionAction } | undefined>(PERMISSION_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    if (!permission) return true;
    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!user || !(await this.permissions.isAllowed(user, permission.module, permission.action))) {
      throw new ForbiddenException('Permissão insuficiente para esta ação');
    }
    return true;
  }
}
