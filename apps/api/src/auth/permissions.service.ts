import { ForbiddenException, Injectable } from '@nestjs/common';
import { SupabaseDataService } from '../supabase/supabase.service';
import { AuthUser } from '../common/auth-user';
import { Role } from '../common/domain-types';
import { defaultPermission, PERMISSION_ACTIONS, PERMISSION_MODULES, PermissionAction, PermissionModule } from '../common/permissions';
import { hasMinRole } from '../common/roles';

@Injectable()
export class PermissionsService {
  constructor(private readonly db: SupabaseDataService) {}

  async isAllowed(user: AuthUser, module: PermissionModule, action: PermissionAction) {
    const override = await this.db.permissionGrant.findUnique({ where: {
      companyId_role_module_action: { companyId: user.companyId, role: user.role, module, action },
    }, select: { enabled: true } });
    return override?.enabled ?? defaultPermission(user.role, module, action);
  }

  async matrix(companyId: string) {
    const roles = Object.values(Role);
    const overrides = await this.db.permissionGrant.findMany({ where: { companyId } });
    const result = roles.flatMap((role) => PERMISSION_MODULES.flatMap((module) => PERMISSION_ACTIONS.map((action) => {
      const override = overrides.find((item) => item.role === role && item.module === module && item.action === action);
      return { role, module, action, enabled: override?.enabled ?? defaultPermission(role, module, action), inherited: !override };
    })));
    return { roles, modules: PERMISSION_MODULES, actions: PERMISSION_ACTIONS, permissions: result };
  }

  async current(user: AuthUser) {
    const matrix = await this.matrix(user.companyId);
    return matrix.permissions.filter((permission) => permission.role === user.role).map(({ module, action, enabled }) => ({ module, action, enabled }));
  }

  async set(user: AuthUser, role: Role, module: PermissionModule, action: PermissionAction, enabled: boolean) {
    if (!hasMinRole(user.role, Role.OWNER) || hasMinRole(role, user.role)) {
      throw new ForbiddenException('Você não pode alterar permissões desse papel');
    }
    if (!PERMISSION_MODULES.includes(module) || !PERMISSION_ACTIONS.includes(action) || !Object.values(Role).includes(role)) {
      throw new ForbiddenException('Permissão inválida');
    }
    if (enabled && !(await this.isAllowed(user, module, action))) {
      throw new ForbiddenException('Não é possível conceder uma permissão acima do seu próprio escopo');
    }
    if (!enabled && role === Role.ADMIN && module === 'settings' && action === 'manage') {
      const owner = await this.db.user.count({ where: { companyId: user.companyId, active: true, role: { in: [Role.OWNER, Role.SUPER_ADMIN] } } });
      if (!owner) throw new ForbiddenException('Mantenha ao menos um administrador responsável ativo');
    }
    await this.db.permissionGrant.upsert({
      where: { companyId_role_module_action: { companyId: user.companyId, role, module, action } },
      create: { companyId: user.companyId, role, module, action, enabled },
      update: { enabled },
    });
    await this.db.auditLog.create({ data: { companyId: user.companyId, actorId: user.id,
      action: 'permissions.updated', entity: 'PermissionGrant', metadata: JSON.stringify({ role, module, action, enabled }) } });
    return { role, module, action, enabled };
  }
}
