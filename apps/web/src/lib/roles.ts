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
  SUPER_ADMIN: 'Super Admin',
  OWNER: 'Company Owner',
  ADMIN: 'Administrator',
  MANAGER: 'Manager',
  TEAM_LEADER: 'Team Leader',
  DEVELOPER: 'Developer',
  GUEST: 'Guest',
};

export const hasMinRole = (role: Role, min: Role) => ROLE_RANK[role] >= ROLE_RANK[min];
