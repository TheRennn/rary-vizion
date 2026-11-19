import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '../common/domain-types';
import { randomBytes } from 'crypto';
import { compare, hash } from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../common/auth-user';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { SupabaseService } from '../supabase/supabase.service';
import { createDemoToken, demoUser, getDemoAccount, isDemoLogin } from './demo-auth';
import { PrismaService } from '../prisma/prisma.service';
import { createLocalToken } from './local-auth';

function slugify(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${base || 'company'}-${randomBytes(2).toString('hex')}`;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
    private readonly prisma: PrismaService,
  ) {}

  async register(dto: RegisterDto): Promise<{ accessToken: string }> {
    if (!this.supabase.isConfigured) {
      if (this.config.get<string>('NODE_ENV') === 'production') {
        throw new ServiceUnavailableException('Cadastro indisponível: configure o provedor de autenticação');
      }
      const existing = await this.prisma.user.findUnique({ where: { email: dto.email }, select: { id: true } });
      if (existing) throw new ConflictException('E-mail já cadastrado');
      const secret = this.config.getOrThrow<string>('JWT_SECRET');
      const passwordHash = await hash(dto.password, 12);
      let user: { id: string };
      try {
        user = await this.prisma.$transaction(async (tx) => {
          const company = await tx.company.create({
            data: { name: dto.companyName.trim(), slug: slugify(dto.companyName) },
            select: { id: true },
          });
          const owner = await tx.user.create({
            data: {
              companyId: company.id,
              name: dto.name.trim(),
              email: dto.email,
              passwordHash,
              role: Role.OWNER,
            },
            select: { id: true },
          });
          await tx.auditLog.create({
            data: { companyId: company.id, actorId: owner.id, action: 'company.registered', entity: 'Company', entityId: company.id },
          });
          return owner;
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException('E-mail já cadastrado');
        }
        throw error;
      }
      return { accessToken: createLocalToken(user.id, secret) };
    }

    const { data, error } = await this.supabase.publicClient.auth.signUp({
      email: dto.email,
      password: dto.password,
      options: { data: { name: dto.name, companyName: dto.companyName } },
    });
    if (error) {
      if (error.status === 400 || error.code === 'user_already_exists') throw new ConflictException('E-mail já cadastrado');
      throw new BadRequestException(error.message);
    }
    if (!data.user || !data.session) throw new BadRequestException('Confirme o e-mail antes de entrar');

    // The database trigger creates the company and owner profile from the
    // signup metadata. Read that row instead of inserting a second company.
    const profile = await this.supabase.adminClient
      .from('users')
      .select('id,company_id')
      .eq('id', data.user.id)
      .single();
    if (profile.error || !profile.data) {
      throw new BadRequestException(profile.error?.message ?? 'Perfil empresarial não foi criado');
    }

    return { accessToken: data.session.access_token };
  }

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    if (isDemoLogin(dto.email, dto.password)) {
      if (this.config.get<string>('NODE_ENV') === 'production') {
        throw new UnauthorizedException('Contas de demonstração não estão disponíveis em produção');
      }
      if (!this.supabase.isConfigured) {
        const seededAccount = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (seededAccount) {
          if (!seededAccount.active || !(await compare(dto.password, seededAccount.passwordHash))) {
            throw new UnauthorizedException('Credenciais inválidas');
          }
          return { accessToken: createLocalToken(seededAccount.id, this.config.getOrThrow<string>('JWT_SECRET')) };
        }
      }
      const secret = this.config.getOrThrow<string>('JWT_SECRET');
      return { accessToken: createDemoToken(dto.email, secret) };
    }
    if (!this.supabase.isConfigured) {
      if (this.config.get<string>('NODE_ENV') === 'production') {
        throw new ServiceUnavailableException('Autenticação indisponível: configure o provedor de autenticação');
      }
      const account = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (!account || !account.active || !(await compare(dto.password, account.passwordHash))) {
        throw new UnauthorizedException('Credenciais inválidas');
      }
      return { accessToken: createLocalToken(account.id, this.config.getOrThrow<string>('JWT_SECRET')) };
    }
    const { data, error } = await this.supabase.publicClient.auth.signInWithPassword({
      email: dto.email,
      password: dto.password,
    });
    if (error || !data.session) throw new UnauthorizedException('Credenciais inválidas');

    const { data: profile, error: profileError } = await this.supabase.adminClient
      .from('users')
      .select('id,active')
      .eq('id', data.user.id)
      .single();
    if (profileError || !profile || !profile.active) throw new UnauthorizedException('Credenciais inválidas');
    return { accessToken: data.session.access_token };
  }

  /**
   * Atalho SOMENTE para desenvolvimento: entra como o owner da empresa demo.
   * Pode ser desativado com DEV_AUTO_LOGIN=false e é bloqueado em NODE_ENV=production.
   */
  async devLogin(): Promise<{ accessToken: string }> {
    const enabled = this.config.get<string>('DEV_AUTO_LOGIN') !== 'false';
    if (!enabled || this.config.get<string>('NODE_ENV') === 'production') throw new NotFoundException();
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    return { accessToken: createDemoToken('owner@demo.com', secret) };
  }

  async me(authUser: AuthUser) {
    const demoAccount = getDemoAccount(authUser.email);

    if (!this.supabase.isConfigured) {
      const account = await this.prisma.user.findUnique({
        where: { id: authUser.id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          jobTitle: true,
          company: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
        },
      });
      if (!account) {
        if (demoAccount) return demoUser(demoAccount);
        throw new NotFoundException('Usuário não encontrado');
      }
      return account;
    }

    if (demoAccount) return demoUser(demoAccount);

    const { data, error } = await this.supabase.adminClient
      .from('users')
      .select('id,name,email,role,job_title,company:companies(id,name),department:departments(id,name)')
      .eq('id', authUser.id)
      .single();
    if (error || !data) throw new NotFoundException('Usuário não encontrado');
    return data;
  }
}
