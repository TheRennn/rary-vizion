import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/auth-user';
import { ROLE_RANK } from '../common/roles';
import { SupabaseDataService } from '../supabase/supabase.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  jobTitle: true,
  active: true,
  createdAt: true,
  department: { select: { id: true, name: true } },
} satisfies Record<string, any>;

@Injectable()
export class UsersService {
  constructor(private readonly db: SupabaseDataService, private readonly audit: AuditService) {}

  private async updateAuthMetadata(userId: string, updates: Record<string, unknown>) {
    const current = await this.db.adminClient.auth.admin.getUserById(userId);
    if (current.error || !current.data.user) throw new BadRequestException('Não foi possível localizar a conta no Supabase Auth');
    const { error } = await this.db.adminClient.auth.admin.updateUserById(userId, {
      app_metadata: { ...current.data.user.app_metadata, ...updates },
    });
    if (error) throw new BadRequestException(`Supabase Auth: ${error.message}`);
  }

  list(companyId: string) {
    return this.db.user.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      select: PUBLIC_USER_SELECT,
    });
  }

  async create(actor: AuthUser, dto: CreateUserDto) {
    // Ninguém cria um usuário com autoridade igual ou superior à própria (evita escalonamento).
    if (ROLE_RANK[dto.role] >= ROLE_RANK[actor.role]) {
      throw new ForbiddenException('Você não pode criar um usuário com esse papel');
    }

    if (dto.departmentId) {
      const department = await this.db.department.findFirst({
        where: { id: dto.departmentId, companyId: actor.companyId },
        select: { id: true },
      });
      if (!department) throw new BadRequestException('Departamento inválido');
    }

    const exists = await this.db.user.findUnique({ where: { email: dto.email }, select: { id: true } });
    if (exists) throw new ConflictException('E-mail já cadastrado');

    try {
      const created = await this.db.adminClient.auth.admin.createUser({
        email: dto.email,
        password: dto.password,
        email_confirm: true,
        user_metadata: { name: dto.name.trim(), departmentId: dto.departmentId ?? null, jobTitle: dto.jobTitle?.trim() || null },
        app_metadata: { companyId: actor.companyId, role: dto.role },
      });
      if (created.error) {
        if (created.error.code === 'email_exists') throw new ConflictException('E-mail já cadastrado');
        throw new BadRequestException(`Supabase Auth: ${created.error.message}`);
      }
      // Old projects may still have the first signup trigger. Re-home the new profile
      // safely until the updated trigger migration is applied.
      const { data: initialProfile, error: initialError } = await this.db.adminClient.from('users').select('company_id').eq('id', created.data.user.id).maybeSingle();
      if (initialError || !initialProfile) throw new BadRequestException('O Supabase Auth criou o acesso, mas o trigger não criou o perfil. Aplique as migrations de supabase/migrations.');
      if (initialProfile.company_id !== actor.companyId) {
        const { error: profileUpdateError } = await this.db.adminClient.from('users').update({ company_id: actor.companyId, role: dto.role, department_id: dto.departmentId ?? null }).eq('id', created.data.user.id);
        if (profileUpdateError) throw new BadRequestException(`Não foi possível associar o usuário à empresa: ${profileUpdateError.message}`);
        await this.db.adminClient.from('companies').delete().eq('id', initialProfile.company_id);
      }
      const user = await this.db.user.findUnique({ where: { id: created.data.user.id }, select: PUBLIC_USER_SELECT });
      if (!user) throw new BadRequestException('O Supabase Auth criou o acesso, mas o perfil não foi sincronizado. Verifique a migration do trigger de usuários.');

      await this.audit.log({
        companyId: actor.companyId,
        actorId: actor.id,
        action: 'user.created',
        entity: 'User',
        entityId: user.id,
        metadata: { email: user.email, role: user.role },
      });
      return user;
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2002') {
        throw new ConflictException('E-mail já cadastrado');
      }
      throw e;
    }
  }

  async update(actor: AuthUser, userId: string, dto: UpdateUserDto) {
    if (Object.keys(dto).length === 0) throw new BadRequestException('Informe ao menos um campo para atualizar');

    const current = await this.db.user.findFirst({
      where: { id: userId, companyId: actor.companyId },
      select: { id: true, role: true, active: true },
    });
    if (!current) throw new NotFoundException('Colaborador não encontrado');

    if (!Object.prototype.hasOwnProperty.call(ROLE_RANK, current.role) || ROLE_RANK[current.role as keyof typeof ROLE_RANK] >= ROLE_RANK[actor.role]) {
      throw new ForbiddenException('Você não pode alterar um usuário com papel igual ou superior ao seu');
    }
    if (dto.role && ROLE_RANK[dto.role] >= ROLE_RANK[actor.role]) {
      throw new ForbiddenException('Você não pode atribuir um papel igual ou superior ao seu');
    }
    if (userId === actor.id && dto.active === false) {
      throw new BadRequestException('Você não pode arquivar a própria conta');
    }
    if (dto.departmentId) {
      const department = await this.db.department.findFirst({
        where: { id: dto.departmentId, companyId: actor.companyId },
        select: { id: true },
      });
      if (!department) throw new BadRequestException('Departamento inválido');
    }

    const data: Record<string, any> = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.jobTitle !== undefined) data.jobTitle = dto.jobTitle?.trim() || null;
    if (Object.prototype.hasOwnProperty.call(dto, 'departmentId')) {
      data.department = dto.departmentId
        ? { connect: { id: dto.departmentId } }
        : { disconnect: true };
    }
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.active !== undefined) data.active = dto.active;

    if (dto.role !== undefined || dto.active !== undefined) {
      await this.updateAuthMetadata(userId, { companyId: actor.companyId, role: dto.role ?? current.role, ...(dto.active !== undefined ? { authValidAfter: new Date().toISOString() } : {}) });
    }
    const user = await this.db.user.update({ where: { id: userId }, data, select: PUBLIC_USER_SELECT });
    await this.audit.log({
      companyId: actor.companyId,
      actorId: actor.id,
      action: dto.active === false ? 'user.archived' : dto.active === true && !current.active ? 'user.reactivated' : 'user.updated',
      entity: 'User',
      entityId: user.id,
      metadata: { changedFields: Object.keys(dto) },
    });
    return user;
  }

  async revokeSessions(actor: AuthUser, userId: string) {
    const target = await this.db.user.findFirst({ where: { id: userId, companyId: actor.companyId }, select: { id: true, role: true } });
    if (!target) throw new NotFoundException('Colaborador não encontrado');
    const targetRank = ROLE_RANK[target.role as keyof typeof ROLE_RANK];
    if (targetRank === undefined || targetRank >= ROLE_RANK[actor.role]) {
      throw new ForbiddenException('Você não pode revogar sessões desse papel');
    }
    await this.updateAuthMetadata(userId, { companyId: actor.companyId, role: target.role, authValidAfter: new Date().toISOString() });
    await this.audit.log({ companyId: actor.companyId, actorId: actor.id, action: 'user.sessions_revoked', entity: 'User', entityId: userId, metadata: { count: 1 } });
    return { revoked: 1 };
  }
}
