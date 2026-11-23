import assert from 'node:assert/strict';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { test } from 'node:test';
import { AuthUser } from '../common/auth-user';
import { SupabaseDataService } from '../supabase/supabase.service';
import { MeetingsService } from './meetings.service';

const user: AuthUser = { id: 'user-a', companyId: 'company-a', role: 'DEVELOPER', name: 'A', email: 'a@example.com', sessionId: 'session-a' };
const future = new Date(Date.now() + 60 * 60_000);
const old = new Date(Date.now() - 60 * 60_000);

let lastWhere: any;
function fixture(meeting: any, meetings: any[] = []) {
  const db = {
    meeting: { findFirst: async () => meeting, findMany: async ({ where }: any) => { lastWhere = where; return meetings; } },
    meetingParticipant: { upsert: async () => ({ ok: true }) },
  };
  return new MeetingsService(db as unknown as SupabaseDataService);
}

test('reunião privada permite organizador e participante convidado', async () => {
  const meeting = { id: 'm1', companyId: user.companyId, code: 'ABCDEFGHIJ', accessMode: 'PRIVATE', createdById: 'organizer', startsAt: future, durationMinutes: 30, participants: [{ userId: user.id }] };
  assert.equal((await fixture(meeting).getByCode(user, meeting.code)).id, 'm1');
  assert.equal((await fixture({ ...meeting, participants: [] }).getByCode({ ...user, id: 'organizer' }, meeting.code)).id, 'm1');
});

test('reunião privada nega pessoa não convidada e empresa sem correspondência', async () => {
  const meeting = { id: 'm1', companyId: user.companyId, code: 'ABCDEFGHIJ', accessMode: 'PRIVATE', createdById: 'organizer', participants: [] };
  await assert.rejects(fixture(meeting).getByCode(user, meeting.code), ForbiddenException);
  await assert.rejects(fixture(null).getByCode(user, meeting.code), NotFoundException);
});

test('ingresso bloqueia reuniões encerradas', async () => {
  const meeting = { id: 'm1', companyId: user.companyId, code: 'ABCDEFGHIJ', accessMode: 'TEAM', createdById: 'organizer', startsAt: old, durationMinutes: 30, participants: [] };
  await assert.rejects(fixture(meeting).joinByCode(user, meeting.code), BadRequestException);
});

test('listagem mantém contexto empresarial e oculta reunião privada de não convidados', async () => {
  const result = await fixture(null, [
    { id: 'team', companyId: user.companyId, accessMode: 'TEAM', participants: [] },
    { id: 'invited', companyId: user.companyId, accessMode: 'PRIVATE', createdById: 'other', participants: [{ userId: user.id }] },
    { id: 'owned', companyId: user.companyId, accessMode: 'PRIVATE', createdById: user.id, participants: [] },
    { id: 'restricted', companyId: user.companyId, accessMode: 'PRIVATE', createdById: 'other', participants: [] },
  ]).list(user);
  const where = lastWhere;
  assert.equal(where.companyId, user.companyId);
  assert.deepEqual(result.map((meeting: any) => meeting.id), ['team', 'invited', 'owned']);
});
