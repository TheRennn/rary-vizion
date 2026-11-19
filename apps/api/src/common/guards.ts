import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Role } from './domain-types';
import { AuthUser } from './auth-user';
import { IS_PUBLIC_KEY, MIN_ROLE_KEY } from './decorators';
import { hasMinRole } from './roles';
import { SupabaseService } from '../supabase/supabase.service';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { readDemoToken } from '../auth/demo-auth';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    if (!token) throw new ForbiddenException('Token de acesso obrigatório');

    if (token.startsWith('demo.')) {
      const demoUser = readDemoToken(token, this.config.getOrThrow<string>('JWT_SECRET'));
      if (!demoUser) throw new ForbiddenException('Sessão demo inválida ou expirada');
      request.user = demoUser;
      return true;
    }

    const { data, error } = await this.supabase.publicClient.auth.getUser(token);
    if (error || !data.user) throw new ForbiddenException('Sessão inválida ou expirada');

    const { data: profile, error: profileError } = await this.supabase.adminClient
      .from('users')
      .select('id,name,email,role,job_title,active,company_id')
      .eq('id', data.user.id)
      .single();
    if (profileError || !profile || !profile.active) throw new ForbiddenException('Usuário inválido ou inativo');

    request.user = {
      id: profile.id,
      companyId: profile.company_id,
      role: profile.role as Role,
      name: profile.name,
      email: profile.email,
    };
    return true;
  }
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
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
