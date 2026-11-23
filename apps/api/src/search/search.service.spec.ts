import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SearchService } from './search.service';
import { AuthUser } from '../common/auth-user';
import { SupabaseDataService } from '../supabase/supabase.service';

const user: AuthUser = { id: 'user-1', companyId: 'company-1', role: 'DEVELOPER', name: 'User', email: 'user@example.com', sessionId: 'session' };

test('busca restringe projetos e tarefas à empresa e respeita as permissões', async () => {
  const projectQueries: any[] = []; let taskWhere: any;
  const db = {
    project: { findMany: async (args: any) => { projectQueries.push(args); return [{ id: 'p1', name: 'Alpha', status: 'ACTIVE' }]; } },
    projectTask: { findMany: async (args: any) => { taskWhere = args.where; return [{ id: 't1', title: 'Alpha task', projectId: 'p1' }]; } },
  };
  const permissions = { isAllowed: async (_user: AuthUser, module: string) => module === 'projects' };
  const result = await new SearchService(db as unknown as SupabaseDataService, permissions as any).search(user, 'alpha');
  assert.equal(projectQueries[0].where.companyId, user.companyId);
  assert.deepEqual(taskWhere.projectId.in, ['p1']);
  assert.equal(result.results.length, 2);
  assert.match(result.results[1].href, /projectId=p1&taskId=t1/);
});

test('busca rejeita termos curtos', async () => {
  const service = new SearchService({} as SupabaseDataService, {} as any);
  await assert.rejects(service.search(user, 'x'), /entre 2 e 100 caracteres/);
});
