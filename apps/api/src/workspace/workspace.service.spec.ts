import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuthUser } from '../common/auth-user';
import { SupabaseDataService } from '../supabase/supabase.service';
import { WorkspaceService } from './workspace.service';

const user: AuthUser = { id: 'user-1', companyId: 'company-1', role: 'DEVELOPER', name: 'User', email: 'user@example.com', sessionId: 'session' };

test('preferências são consultadas pelo usuário e pela empresa da sessão', async () => {
  let where: any;
  const service = new WorkspaceService({ workspacePreference: { findFirst: async (args: any) => { where = args.where; return null; } } as any } as SupabaseDataService);
  const layout = await service.getPreferences(user);
  assert.deepEqual(where, { userId: user.id, companyId: user.companyId });
  assert.ok(layout.order.includes('focus'));
});

test('preferências inválidas não são persistidas', async () => {
  let persisted = false;
  const service = new WorkspaceService({ workspacePreference: { findFirst: async () => null, create: async () => { persisted = true; } } as any } as SupabaseDataService);
  await assert.rejects(service.savePreferences(user, { order: ['admin'], hidden: [] }), /Layout de widgets inválido/);
  assert.equal(persisted, false);
});

test('layout válido preserva o widget Minha semana e persiste no usuário da sessão', async () => {
  let mutation: any;
  const service = new WorkspaceService({ workspacePreference: { upsert: async (args: any) => { mutation = args; return args.create; } } as any } as SupabaseDataService);
  const result = await service.savePreferences(user, { order: ['week', 'focus'], hidden: ['chat'] });
  assert.equal(mutation.where.userId, user.id);
  assert.equal(mutation.create.companyId, user.companyId);
  assert.deepEqual(result.layout.hidden, ['chat']);
  assert.ok(result.layout.order.includes('week'));
});

test('foco não pode iniciar em tarefa pertencente a outra empresa', async () => {
  const service = new WorkspaceService({ projectTask: { findFirst: async () => ({ id: 'task-x', projectId: 'project-x' }) }, project: { findFirst: async () => null } } as any as SupabaseDataService);
  await assert.rejects(service.startFocus(user, 'task-x'), /Tarefa não encontrada/);
});
