import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
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
import { readLocalToken } from '../auth/local-auth';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
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
    if (!token) throw new UnauthorizedException('Token de acesso obrigatório');

    if (token.startsWith('demo.')) {
      if (this.config.get<string>('NODE_ENV') === 'production') {
        throw new UnauthorizedException('Sessão de demonstração não permitida em produção');
      }
      const demoUser = readDemoToken(token, this.config.getOrThrow<string>('JWT_SECRET'));
      if (!demoUser) throw new UnauthorizedException('Sessão demo inválida ou expirada');
      if (!this.supabase.isConfigured) {
        const seededAccount = await this.prisma.user.findUnique({ where: { id: demoUser.id } });
        if (seededAccount && !seededAccount.active) throw new UnauthorizedException('Usuário inválido ou inativo');
        if (seededAccount) {
          request.user = {
            id: seededAccount.id,
            companyId: seededAccount.companyId,
            role: seededAccount.role as Role,
            name: seededAccount.name,
            email: seededAccount.email,
          };
          return true;
        }
      }
      request.user = demoUser;
      return true;
    }

    if (token.startsWith('local.')) {
      if (this.supabase.isConfigured || this.config.get<string>('NODE_ENV') === 'production') {
        throw new UnauthorizedException('Sessão local não permitida neste ambiente');
      }
      const payload = readLocalToken(token, this.config.getOrThrow<string>('JWT_SECRET'));
      if (!payload) throw new UnauthorizedException('Sessão local inválida ou expirada');
      const account = await this.prisma.user.findUnique({ where: { id: payload.userId } });
      if (!account || !account.active) throw new UnauthorizedException('Usuário inválido ou inativo');
      request.user = {
        id: account.id,
        companyId: account.companyId,
        role: account.role as Role,
        name: account.name,
        email: account.email,
      };
      return true;
    }

    const { data, error } = await this.supabase.publicClient.auth.getUser(token);
    if (error || !data.user) throw new UnauthorizedException('Sessão inválida ou expirada');

    const { data: profile, error: profileError } = await this.supabase.adminClient
      .from('users')
      .select('id,name,email,role,job_title,active,company_id')
      .eq('id', data.user.id)
      .single();
    if (profileError || !profile || !profile.active) throw new UnauthorizedException('Usuário inválido ou inativo');

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
