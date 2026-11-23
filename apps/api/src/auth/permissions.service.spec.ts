import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { test } from 'node:test';
import { AuthUser } from '../common/auth-user';
import { SupabaseDataService } from '../supabase/supabase.service';
import { PermissionsService } from './permissions.service';

const owner: AuthUser = { id: 'owner', companyId: 'company-a', role: 'OWNER', name: 'Owner', email: 'owner@example.com', sessionId: 'session' };
test('papéis padrão calculam permissões por ação e módulo', async () => {
  const service = new PermissionsService({ permissionGrant: { findUnique: async () => null } } as unknown as SupabaseDataService);
  assert.equal(await service.isAllowed({ ...owner, role: 'DEVELOPER' }, 'chat', 'create'), true);
  assert.equal(await service.isAllowed({ ...owner, role: 'GUEST' }, 'workforce', 'delete'), false);
  assert.equal(await service.isAllowed({ ...owner, role: 'MANAGER' }, 'time', 'approve'), true);
});

test('proprietário não pode alterar papel igual ou superior', async () => {
  const service = new PermissionsService({} as SupabaseDataService);
  await assert.rejects(service.set(owner, 'OWNER', 'projects', 'view', false), ForbiddenException);
  await assert.rejects(service.set(owner, 'SUPER_ADMIN', 'projects', 'view', false), ForbiddenException);
});

test('override granular persiste empresa e gera trilha de auditoria', async () => {
  let saved: any;
  let audit: any;
  const db = {
    permissionGrant: { findUnique: async () => null, upsert: async (args: any) => { saved = args; return args.create; } },
    auditLog: { create: async (args: any) => { audit = args; } },
  };
  const service = new PermissionsService(db as unknown as SupabaseDataService);
  await service.set(owner, 'ADMIN', 'projects', 'delete', true);
  assert.equal(saved.create.companyId, owner.companyId);
  assert.equal(saved.create.enabled, true);
  assert.equal(audit.data.actorId, owner.id);
  assert.equal(audit.data.action, 'permissions.updated');
});
