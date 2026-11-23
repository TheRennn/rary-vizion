import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CalendarService } from './calendar.service';
import { AuthUser } from '../common/auth-user';
import { SupabaseDataService } from '../supabase/supabase.service';

const user: AuthUser = { id: 'user-1', companyId: 'company-1', role: 'DEVELOPER', name: 'User', email: 'user@example.com', sessionId: 'session' };

test('calendário oculta eventos privados de outros usuários e limita empresa', async () => {
  let where: any;
  const events = [
    { id: 'shared', createdById: 'other', accessMode: 'TEAM', title: 'Team', startsAt: new Date('2026-11-21T10:00:00Z'), endsAt: new Date('2026-11-21T11:00:00Z') },
    { id: 'private', createdById: 'other', accessMode: 'PRIVATE', title: 'Secret', startsAt: new Date('2026-11-21T12:00:00Z'), endsAt: new Date('2026-11-21T13:00:00Z') },
  ];
  const db = { calendarEvent: { findMany: async (args: any) => { where = args.where; return events; } } };
  const permissions = { isAllowed: async () => false };
  const result = await new CalendarService(db as any as SupabaseDataService, permissions as any).list(user, '2026-11-21T00:00:00Z', '2026-11-22T00:00:00Z');
  assert.equal(where.companyId, user.companyId);
  assert.deepEqual(result.map((item) => item.id), ['shared']);
});

test('calendário rejeita intervalos extensos e inválidos', async () => {
  const service = new CalendarService({} as SupabaseDataService, {} as any);
  await assert.rejects(service.list(user, '2026-01-01', '2026-06-01'), /máximo de 93 dias/);
});
