import { ConflictException, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthUser } from '../common/auth-user';
import { Role } from '../common/domain-types';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { SupabaseDataService } from '../supabase/supabase.service';

@Injectable()
export class AuthService {
  constructor(private readonly config: ConfigService, private readonly supabase: SupabaseDataService) {}

  private async sessionFrom(result: any) {
    if (result.error || !result.data?.session || !result.data.user) {
      throw new UnauthorizedException(result.error?.message ?? 'O Supabase não criou uma sessão. Verifique a confirmação de e-mail no painel.');
    }
    const expiresAt = new Date((result.data.session.expires_at ?? Math.floor(Date.now() / 1000) + 3600) * 1000);
    return { token: result.data.session.access_token as string, refreshToken: result.data.session.refresh_token as string, expiresAt };
  }

  async register(dto: RegisterDto) {
    const result = await this.supabase.publicClient.auth.signUp({
      email: dto.email,
      password: dto.password,
      options: { data: { name: dto.name.trim(), companyName: dto.companyName.trim() } },
    });
    if (result.error) throw new UnauthorizedException(result.error.message);
    if (result.data.user?.identities?.length === 0) throw new ConflictException('E-mail já cadastrado');
    if (!result.data.session) throw new ServiceUnavailableException('Confirme seu e-mail para concluir o cadastro. A sessão será criada após a confirmação.');
    return this.sessionFrom(result);
  }

  async login(dto: LoginDto) {
    return this.sessionFrom(await this.supabase.publicClient.auth.signInWithPassword({ email: dto.email, password: dto.password }));
  }

  async devLogin() {
    if (
      this.config.get<string>('DEV_AUTO_LOGIN') === 'false'
      || this.config.get<string>('NODE_ENV') === 'production'
      || (!this.supabase.development && !this.supabase.local)
    ) throw new NotFoundException();
    const email = 'owner@demo.com';
    const password = this.config.get<string>('DEV_DEMO_PASSWORD') ?? 'Demo@12345';
    const listed = await this.supabase.adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listed.error) throw new ServiceUnavailableException('Não foi possível consultar os usuários de desenvolvimento no Supabase');
    const existing = listed.data.users.find((user) => user.email?.toLowerCase() === email);
    let userId: string;
    if (existing) {
      userId = existing.id;
      const updated = await this.supabase.adminClient.auth.admin.updateUserById(userId, { password, email_confirm: true });
      if (updated.error) throw new ServiceUnavailableException(`Não foi possível preparar o usuário demo no Supabase: ${updated.error.message}`);
    } else {
      const created = await this.supabase.adminClient.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: 'Owner Demo', companyName: 'RARY Demo' } });
      if (created.error && created.error.code !== 'email_exists') throw new ServiceUnavailableException(`Não foi possível criar o usuário demo no Supabase: ${created.error.message}`);
      if (created.error) throw new ServiceUnavailableException('O usuário demo foi criado em paralelo; tente novamente.');
      userId = created.data.user.id;
    }

    const { data: profile, error: profileError } = await this.supabase.adminClient.from('users')
      .update({ role: 'OWNER', active: true })
      .eq('id', userId)
      .select('id')
      .maybeSingle();
    if (profileError) throw new ServiceUnavailableException(`Não foi possível preparar o perfil demo: ${profileError.message}`);
    if (!profile) throw new ServiceUnavailableException('O perfil demo não existe. Aplique as migrations do Supabase antes de entrar.');
    return this.sessionFrom(await this.supabase.publicClient.auth.signInWithPassword({ email, password }));
  }

  async authenticate(token: string): Promise<AuthUser> {
    const { data, error } = await this.supabase.publicClient.auth.getUser(token);
    if (error || !data.user) throw new UnauthorizedException('Sessão Supabase inválida ou expirada');
    let tokenIssuedAt = 0;
    try { tokenIssuedAt = Number(JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).iat); } catch { throw new UnauthorizedException('Token Supabase inválido'); }
    const { data: profile, error: profileError } = await this.supabase.adminClient.from('users')
      .select('id,company_id,name,email,role,active').eq('id', data.user.id).maybeSingle();
    if (profileError || !profile || !profile.active) throw new UnauthorizedException('Perfil inexistente ou inativo no Supabase');
    const validAfter = Date.parse(String(data.user.app_metadata?.authValidAfter ?? ''));
    if (Number.isFinite(validAfter) && tokenIssuedAt <= Math.floor(validAfter / 1000)) throw new UnauthorizedException('Sessão revogada');
    return { id: profile.id, companyId: profile.company_id, role: profile.role as Role, name: profile.name, email: profile.email, sessionId: token };
  }

  async logout(accessToken: string) {
    const { error } = await this.supabase.adminClient.auth.admin.signOut(accessToken, 'local');
    if (error) throw new UnauthorizedException('Não foi possível encerrar a sessão Supabase');
    return { success: true };
  }

  async refresh(refreshToken: string) {
    const result = await this.supabase.publicClient.auth.refreshSession({ refresh_token: refreshToken });
    return this.sessionFrom(result);
  }

  async listSessions(_userId: string) { return []; }
  async revokeSession(_userId: string, _sessionId: string) { throw new NotFoundException('Sessão individual não é gerenciada pela aplicação'); }
  async revokeAllSessions(accessToken: string) {
    const { error } = await this.supabase.adminClient.auth.admin.signOut(accessToken, 'global');
    if (error) throw new UnauthorizedException('Não foi possível encerrar as sessões no Supabase');
    return { revoked: 1 };
  }

  async me(authUser: AuthUser) {
    const { data, error } = await this.supabase.adminClient.from('users').select('id,name,email,role,job_title,company:companies(id,name),department:departments(id,name)').eq('id', authUser.id).maybeSingle();
    if (error || !data) throw new NotFoundException('Usuário não encontrado no Supabase');
    return { id: data.id, name: data.name, email: data.email, role: data.role, jobTitle: data.job_title, company: data.company, department: data.department };
  }
}
