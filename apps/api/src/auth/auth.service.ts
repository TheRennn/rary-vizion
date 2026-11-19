import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '../common/domain-types';
import { randomBytes } from 'crypto';
import { AuthUser } from '../common/auth-user';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { SupabaseService } from '../supabase/supabase.service';
import { createDemoToken, demoUser, getDemoAccount, isDemoLogin } from './demo-auth';

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
  ) {}

  async register(dto: RegisterDto): Promise<{ accessToken: string }> {
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

    const company = await this.supabase.adminClient
      .from('companies')
      .insert({ name: dto.companyName, slug: slugify(dto.companyName) })
      .select('id')
      .single();
    if (company.error) throw new BadRequestException(company.error.message);

    const profile = await this.supabase.adminClient.from('users').upsert({
      id: data.user.id,
      company_id: company.data.id,
      name: dto.name,
      email: dto.email,
      role: Role.OWNER,
      active: true,
    });
    if (profile.error) throw new BadRequestException(profile.error.message);

    return { accessToken: data.session.access_token };
  }

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    if (isDemoLogin(dto.email, dto.password)) {
      const secret = this.config.getOrThrow<string>('JWT_SECRET');
      return { accessToken: createDemoToken(dto.email, secret) };
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
