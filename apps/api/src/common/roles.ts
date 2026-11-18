import { Role } from './domain-types';

/** Hierarquia de papéis: quanto maior o número, maior a autoridade. */
export const ROLE_RANK: Record<Role, number> = {
  GUEST: 0,
  DEVELOPER: 1,
  TEAM_LEADER: 2,
  MANAGER: 3,
  ADMIN: 4,
  OWNER: 5,
  SUPER_ADMIN: 6,
};

export function hasMinRole(role: Role, min: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}
