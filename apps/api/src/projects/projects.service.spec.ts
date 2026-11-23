import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { test } from 'node:test';
import { AuthUser } from '../common/auth-user';
import { SupabaseDataService } from '../supabase/supabase.service';
import { ProjectsService } from './projects.service';

const user: AuthUser = { id: 'user-a', companyId: 'company-a', role: 'MANAGER', name: 'A', email: 'a@example.com', sessionId: 'session-a' };
test('projeto rejeita responsável de outra empresa na criação', async () => {
  let created = false;
  const db = { user: { findFirst: async () => null }, project: { create: async () => { created = true; } } };
  const service = new ProjectsService(db as unknown as SupabaseDataService);
  await assert.rejects(service.create(user, { name: 'Project', ownerId: 'user-b' }), BadRequestException);
  assert.equal(created, false);
});

test('tarefa rejeita responsável de outra empresa no projeto autorizado', async () => {
  const db = {
    project: { findFirst: async () => ({ id: 'project-a', companyId: user.companyId }) },
    user: { findFirst: async () => null },
    projectTask: { create: async () => { throw new Error('must not create'); } },
  };
  const service = new ProjectsService(db as unknown as SupabaseDataService);
  await assert.rejects(service.createTask(user, 'project-a', { title: 'Task', assigneeId: 'user-b' }), BadRequestException);
});

test('comentário é restrito ao projeto e à tarefa do caminho', async () => {
  const db = {
    project: { findFirst: async () => ({ id: 'project-a', companyId: user.companyId }) },
    projectTask: { findFirst: async () => null },
    projectTaskComment: { create: async () => { throw new Error('must not create'); } },
  };
  const service = new ProjectsService(db as unknown as SupabaseDataService);
  await assert.rejects(service.addComment(user, 'project-a', 'task-from-another-project', 'comentário'), /Tarefa não encontrada/);
});

test('somente autor edita comentário', async () => {
  const db = {
    project: { findFirst: async () => ({ id: 'project-a', companyId: user.companyId }) },
    projectTask: { findFirst: async () => ({ id: 'task-a' }) },
    projectTaskComment: { findFirst: async () => ({ id: 'comment-a', authorId: 'user-b' }), update: async () => { throw new Error('must not update'); } },
  };
  const service = new ProjectsService(db as unknown as SupabaseDataService);
  await assert.rejects(service.editComment(user, 'project-a', 'task-a', 'comment-a', 'alterado'), /Somente o autor/);
});

test('admin não remove comentário de tarefa que não pertence ao projeto informado', async () => {
  const db = {
    project: { findFirst: async () => ({ id: 'project-a', companyId: user.companyId }) },
    projectTask: { findFirst: async () => null },
    projectTaskComment: { findFirst: async () => ({ id: 'foreign-comment', authorId: 'user-b' }), deleteMany: async () => { throw new Error('must not delete'); } },
  };
  const service = new ProjectsService(db as unknown as SupabaseDataService);
  await assert.rejects(service.deleteComment(user, 'project-a', 'task-from-another-project', 'foreign-comment'), /Tarefa não encontrada/);
});

test('subtarefa deve apontar para tarefa pai do mesmo projeto', async () => {
  const db = {
    project: { findFirst: async () => ({ id: 'project-a', companyId: user.companyId }) },
    projectTask: { findFirst: async () => null, create: async () => { throw new Error('must not create'); } },
  };
  const service = new ProjectsService(db as unknown as SupabaseDataService);
  await assert.rejects(service.createTask(user, 'project-a', { title: 'Filha', parentTaskId: 'foreign-task' }), /mesmo projeto/);
});

test('dependência que formaria ciclo é recusada', async () => {
  const db = {
    project: { findFirst: async () => ({ id: 'project-a', companyId: user.companyId }) },
    projectTask: { findFirst: async () => ({ id: 'task-a' }) },
    projectTaskDependency: { findFirst: async () => null, findMany: async () => [{ dependsOnTaskId: 'task-a' }], create: async () => { throw new Error('must not create'); } },
  };
  const service = new ProjectsService(db as unknown as SupabaseDataService);
  await assert.rejects(service.addDependency(user, 'project-a', 'task-a', 'task-b'), /criaria um ciclo/);
});

test('datas de início posteriores ao prazo são rejeitadas antes da gravação', async () => {
  let writes = 0;
  const db = {
    project: { findFirst: async () => ({ id: 'project-a', companyId: user.companyId }) },
    projectTask: { create: async () => { writes += 1; } },
  };
  const service = new ProjectsService(db as unknown as SupabaseDataService);
  await assert.rejects(service.createTask(user, 'project-a', { title: 'Tarefa', startsAt: '2026-12-02T00:00:00Z', dueAt: '2026-12-01T00:00:00Z' }), /anterior ao prazo/);
  assert.equal(writes, 0);
});

test('cronograma altera datas e grava/limpa conclusão conforme status', async () => {
  const mutations: any[] = [];
  const db = {
    project: { findFirst: async () => ({ id: 'project-a', companyId: user.companyId }) },
    projectTask: {
      findFirst: async () => ({ id: 'task-a', projectId: 'project-a', status: 'IN_PROGRESS', startsAt: null, dueAt: null }),
      update: async (args: any) => { mutations.push(args.data); return args.data; },
    },
  };
  const service = new ProjectsService(db as unknown as SupabaseDataService);
  await service.updateTask(user, 'project-a', 'task-a', { startsAt: '2026-12-01T00:00:00Z', dueAt: '2026-12-04T00:00:00Z', status: 'DONE', isMilestone: true });
  assert.equal(mutations[0].startsAt.toISOString(), '2026-12-01T00:00:00.000Z');
  assert.equal(mutations[0].dueAt.toISOString(), '2026-12-04T00:00:00.000Z');
  assert.equal(mutations[0].isMilestone, true);
  assert.ok(mutations[0].completedAt instanceof Date);
  db.projectTask.findFirst = async () => ({ id: 'task-a', projectId: 'project-a', status: 'DONE', startsAt: null, dueAt: null });
  await service.updateTask(user, 'project-a', 'task-a', { status: 'TODO' });
  assert.equal(mutations[1].completedAt, null);
});
