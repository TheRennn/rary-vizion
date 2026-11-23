import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuthUser } from '../common/auth-user';
import { SupabaseDataService } from '../supabase/supabase.service';
import { ActivityService } from './activity.service';

const user: AuthUser = { id: 'user-a', companyId: 'company-a', role: 'OWNER', name: 'A', email: 'a@example.com', sessionId: 'session' };
const projectId = '95e7035b-2a32-4b7f-84ac-0cb17fbe2730';

test('activity feed always scopes company and private recipient, and returns bounded cursor pages', async () => {
  let args: any;
  const rows = Array.from({ length: 21 }, (_, index) => ({ id: `event-${index}` }));
  const service = new ActivityService({ activityEvent: { findMany: async (value: any) => { args = value; return rows; } } } as any as SupabaseDataService);
  const result = await service.list(user, { module: 'projects', projectId, q: 'design', cursor: projectId });
  assert.equal(args.where.companyId, user.companyId);
  assert.deepEqual(args.where.OR, [{ targetUserId: null }, { targetUserId: user.id }]);
  assert.equal(args.where.module, 'projects');
  assert.equal(args.where.projectId, projectId);
  assert.equal(args.where.title.contains, 'design');
  assert.deepEqual(args.cursor, { id: projectId });
  assert.equal(args.take, 21);
  assert.equal(result.items.length, 20);
  assert.equal(result.nextCursor, 'event-19');
});

test('activity feed rejects invalid module, period, project, cursor and short search', async () => {
  const service = new ActivityService({ activityEvent: { findMany: async () => [] } } as any as SupabaseDataService);
  await assert.rejects(service.list(user, { module: 'chat' }), /Módulo de atividade inválido/);
  await assert.rejects(service.list(user, { from: 'bad-date' }), /Período de atividade inválido/);
  await assert.rejects(service.list(user, { q: 'x' }), /ao menos 2 caracteres/);
  await assert.rejects(service.list(user, { projectId: 'not-a-uuid' }), /Projeto inválido/);
  await assert.rejects(service.list(user, { cursor: 'not-a-uuid' }), /Cursor inválido/);
});

test('activity recorder writes a minimal summary and audience scope, without source text', async () => {
  let stored: any;
  const service = { activityEvent: { create: async (args: any) => { stored = args.data; } } } as any;
  const { recordActivity } = await import('./activity-writer');
  await recordActivity(service, user, { eventType: 'comment.created', module: 'projects', title: 'Comentário adicionado', entityType: 'task', entityId: projectId, projectId, targetUserId: user.id, href: `/projects?projectId=${projectId}` });
  assert.equal(stored.companyId, user.companyId);
  assert.equal(stored.targetUserId, user.id);
  assert.equal(stored.body, undefined);
  assert.equal(stored.metadata, undefined);
});
