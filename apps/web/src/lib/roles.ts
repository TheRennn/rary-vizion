import type { Role } from './types';

export const ROLE_RANK: Record<Role, number> = {
  GUEST: 0,
  DEVELOPER: 1,
  TEAM_LEADER: 2,
  MANAGER: 3,
  ADMIN: 4,
  OWNER: 5,
  SUPER_ADMIN: 6,
};

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'Superadministrador',
  OWNER: 'Proprietário da empresa',
  ADMIN: 'Administrador',
  MANAGER: 'Gestor',
  TEAM_LEADER: 'Líder de equipe',
  DEVELOPER: 'Desenvolvedor',
  GUEST: 'Convidado',
};

export const hasMinRole = (role: Role, min: Role) => ROLE_RANK[role] >= ROLE_RANK[min];
