import { Role } from './domain-types';

export const PERMISSION_MODULES = [
  'dashboard', 'inbox', 'workspace', 'workforce', 'time', 'projects', 'chat', 'voice',
  'meetings', 'monitor', 'intelligence', 'documents', 'reports', 'automations', 'audit', 'settings',
] as const;
export const PERMISSION_ACTIONS = ['view', 'create', 'edit', 'delete', 'manage', 'approve', 'export', 'invite'] as const;
export type PermissionModule = (typeof PERMISSION_MODULES)[number];
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

const rank: Record<Role, number> = { GUEST: 0, DEVELOPER: 1, TEAM_LEADER: 2, MANAGER: 3, ADMIN: 4, OWNER: 5, SUPER_ADMIN: 6 };

export function defaultPermission(role: Role, module: PermissionModule, action: PermissionAction): boolean {
  const level = rank[role];
  const viewMinimum: Record<PermissionModule, number> = {
    dashboard: 0, inbox: 0, workspace: 0, workforce: 1, time: 0, projects: 1, chat: 0, voice: 1,
    meetings: 0, monitor: 3, intelligence: 3, documents: 1, reports: 2, automations: 3, audit: 4, settings: 4,
  };
  if (action === 'view') return level >= viewMinimum[module];
  if (action === 'export') return level >= (module === 'audit' ? 4 : 3);
  if (action === 'invite') return level >= (module === 'meetings' ? 1 : 3);
  if (action === 'approve') return level >= 3 && ['time', 'workforce', 'projects'].includes(module);
  if (action === 'create') return level >= (module === 'time' ? 0 : ['chat', 'meetings', 'inbox', 'documents', 'voice'].includes(module) ? 1 : ['workforce', 'settings', 'audit'].includes(module) ? 4 : 2);
  if (action === 'edit') return level >= (['workforce', 'settings', 'audit'].includes(module) ? 4 : 3);
  if (action === 'delete') return level >= (['settings', 'audit'].includes(module) ? 5 : 4);
  if (action === 'manage') return level >= (module === 'settings' ? 5 : 4);
  return false;
}
