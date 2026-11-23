import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const localEnvPath = new URL('../.env.dev.local', import.meta.url);
let localEnv;
try { localEnv = await readFile(localEnvPath, 'utf8'); } catch {
  throw new Error('apps/api/.env.dev.local não existe. Configure o projeto Supabase dev autorizado antes do teste integrado.');
}
const values = Object.fromEntries(localEnv.split(/\r?\n/).flatMap((line) => {
  const current = line.trim();
  if (!current || current.startsWith('#')) return [];
  const index = current.indexOf('=');
  return index > 0 ? [[current.slice(0, index), current.slice(index + 1)]] : [];
}));
if (values.SUPABASE_ENVIRONMENT !== 'development') throw new Error('Teste recusado: .env.dev.local precisa declarar SUPABASE_ENVIRONMENT=development.');
const supabaseUrl = new URL(values.SUPABASE_URL ?? '');
const projectRef = values.SUPABASE_PROJECT_REF;
if (supabaseUrl.protocol !== 'https:' || !/^[a-z0-9]{20}$/.test(projectRef ?? '') || supabaseUrl.hostname !== `${projectRef}.supabase.co`) {
  throw new Error('Teste recusado: URL HTTPS deve corresponder ao ref do projeto dev configurado.');
}
const apiBase = new URL(process.env.VIZION_TEST_API_URL ?? 'http://127.0.0.1:3333/api');
if (apiBase.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(apiBase.hostname)) {
  throw new Error('Teste recusado: a API também precisa estar em loopback.');
}
const publicKey = values.SUPABASE_PUBLISHABLE_KEY;
const secretKey = values.SUPABASE_SECRET_KEY;
if (!publicKey || !secretKey) throw new Error('O arquivo local precisa conter chaves emitidas pelo Supabase CLI.');
const admin = createClient(supabaseUrl.origin, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const prefix = `VizionIntegration${randomUUID().replaceAll('-', '').slice(0, 12)}`;
const password = `Integration-${randomUUID()}-Aa9!`;
const owners = [];

async function request(path, { method = 'GET', cookie = '', body } = {}) {
  const response = await fetch(new URL(path.replace(/^\//, ''), `${apiBase.href.replace(/\/$/, '')}/`), {
    method,
    headers: { ...(cookie ? { cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  const cookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : (response.headers.get('set-cookie') ?? '').split(/, (?=[^;,]+=)/);
  const sessionCookie = cookies.map((value) => value.split(';', 1)[0]).filter(Boolean).join('; ');
  return { response, data, cookie: sessionCookie || cookie };
}

async function must(path, options = {}) {
  const result = await request(path, options);
  assert.ok(result.response.ok, `${options.method ?? 'GET'} ${path} returned HTTP ${result.response.status}`);
  return { ...result, data: result.data };
}

async function register(suffix) {
  const email = `${prefix.toLowerCase()}-${suffix}@example.invalid`;
  const result = await must('/auth/register', { method: 'POST', body: { companyName: `${prefix} ${suffix}`, name: `${prefix} ${suffix}`, email, password } });
  const me = await must('/auth/me', { cookie: result.cookie });
  const owner = { cookie: result.cookie, id: me.data.id, companyId: me.data.company.id };
  owners.push(owner);
  return owner;
}

const health = await must('/health');
assert.equal(health.data.target, 'development', 'API health endpoint must confirm the isolated development project target');
assert.equal(health.data.services.supabase, 'ok', 'API must be connected to its local Supabase');

try {
  const owner = await register('a');
  const projectName = `${prefix} Projeto`;
  const project = (await must('/projects', { method: 'POST', cookie: owner.cookie, body: { name: projectName } })).data;
  const task = (await must(`/projects/${project.id}/tasks`, { method: 'POST', cookie: owner.cookie, body: { title: `${prefix} Tarefa`, assigneeId: owner.id, dueAt: new Date(Date.now() + 86400_000).toISOString() } })).data;
  const subtask = (await must(`/projects/${project.id}/tasks`, { method: 'POST', cookie: owner.cookie, body: { title: `${prefix} Subtarefa`, parentTaskId: task.id } })).data;
  assert.equal(subtask.parentTaskId, task.id, 'subtask must persist its parent relation');
  await must(`/projects/${project.id}/tasks/${task.id}`, { method: 'PATCH', cookie: owner.cookie, body: { status: 'DONE' } });
  const persisted = (await must(`/projects/${project.id}`, { cookie: owner.cookie })).data;
  assert.equal(persisted.tasks.find((item) => item.id === task.id)?.status, 'DONE', 'task status must survive an API read');
  await must(`/projects/${project.id}/tasks/${subtask.id}`, { method: 'DELETE', cookie: owner.cookie });
  const afterSubtaskDelete = (await must(`/projects/${project.id}`, { cookie: owner.cookie })).data;
  assert.equal(afterSubtaskDelete.tasks.some((item) => item.id === subtask.id), false, 'task deletion must persist');

  const comment = (await must(`/projects/${project.id}/tasks/${task.id}/comments`, { method: 'POST', cookie: owner.cookie, body: { body: `${prefix} comentário descartável` } })).data;
  await must(`/projects/${project.id}/tasks/${task.id}/comments/${comment.id}`, { method: 'PATCH', cookie: owner.cookie, body: { body: `${prefix} comentário editado` } });
  const comments = await must(`/projects/${project.id}/tasks/${task.id}/comments`, { cookie: owner.cookie });
  assert.ok(comments.data.some((item) => item.id === comment.id && item.body.endsWith('editado')));
  await must(`/projects/${project.id}/tasks/${task.id}/comments/${comment.id}`, { method: 'DELETE', cookie: owner.cookie });

  const secondTask = (await must(`/projects/${project.id}/tasks`, { method: 'POST', cookie: owner.cookie, body: { title: `${prefix} Dependência` } })).data;
  await must(`/projects/${project.id}/tasks/${task.id}/dependencies`, { method: 'POST', cookie: owner.cookie, body: { dependsOnTaskId: secondTask.id } });
  const cycle = await request(`/projects/${project.id}/tasks/${secondTask.id}/dependencies`, { method: 'POST', cookie: owner.cookie, body: { dependsOnTaskId: task.id } });
  assert.equal(cycle.response.status, 400, 'dependency cycle must be rejected');

  const layout = { order: ['week', 'focus', 'projects'], hidden: ['chat'] };
  await must('/workspace/preferences', { method: 'PATCH', cookie: owner.cookie, body: layout });
  assert.deepEqual((await must('/workspace/preferences', { cookie: owner.cookie })).data.hidden, ['chat']);
  await must('/workspace/focus', { method: 'POST', cookie: owner.cookie, body: { taskId: secondTask.id } });
  await must('/workspace/focus/pause', { method: 'POST', cookie: owner.cookie });
  await must('/workspace/focus/resume', { method: 'POST', cookie: owner.cookie });
  await must('/workspace/focus/finish', { method: 'POST', cookie: owner.cookie });
  const focus = await must('/workspace/focus', { cookie: owner.cookie });
  assert.ok(focus.data.history.some((item) => item.taskId === secondTask.id && item.status === 'COMPLETED'));

  const startsAt = new Date(Date.now() + 2 * 86400_000).toISOString();
  const endsAt = new Date(Date.now() + 2 * 86400_000 + 3_600_000).toISOString();
  const event = (await must('/calendar', { method: 'POST', cookie: owner.cookie, body: { title: `${prefix} Evento`, startsAt, endsAt, accessMode: 'PRIVATE' } })).data;
  await must(`/calendar/${event.id}`, { method: 'PATCH', cookie: owner.cookie, body: { title: `${prefix} Evento atualizado` } });
  const rangeFrom = new Date(Date.now() + 86400_000).toISOString();
  const rangeTo = new Date(Date.now() + 4 * 86400_000).toISOString();
  const calendar = await must(`/calendar?from=${encodeURIComponent(rangeFrom)}&to=${encodeURIComponent(rangeTo)}`, { cookie: owner.cookie });
  assert.ok(calendar.data.some((item) => item.id === event.id && item.title.endsWith('atualizado')));
  const activities = await must('/activity?module=projects', { cookie: owner.cookie });
  assert.ok(activities.data.items.some((item) => item.entityId === task.id && item.eventType === 'task.completed'));
  assert.equal(activities.data.items.some((item) => JSON.stringify(item).includes('comentário editado')), false, 'activity summaries must omit comment content');
  const search = await must(`/search?q=${encodeURIComponent(prefix)}`, { cookie: owner.cookie });
  assert.ok(search.data.results.some((item) => item.title === projectName));

  const other = await register('b');
  const crossTenant = await request(`/projects/${project.id}`, { cookie: other.cookie });
  assert.equal(crossTenant.response.status, 404, 'company B must not read company A project');
  const companyProjects = await must('/projects', { cookie: other.cookie });
  assert.equal(companyProjects.data.some((item) => item.id === project.id), false);
  const privateCalendar = await must(`/calendar?from=${encodeURIComponent(rangeFrom)}&to=${encodeURIComponent(rangeTo)}`, { cookie: other.cookie });
  assert.equal(privateCalendar.data.some((item) => item.id === event.id), false, 'private calendar event must be invisible to another company');
  await must(`/calendar/${event.id}`, { method: 'DELETE', cookie: owner.cookie });

  const clockIn = await must('/time/clock', { method: 'POST', cookie: owner.cookie, body: { type: 'CLOCK_IN', note: `${prefix} entrada` } });
  assert.equal(clockIn.data.status, 'WORKING');
  const today = await must('/time/today', { cookie: owner.cookie });
  assert.ok(today.data.entries.some((item) => item.id === clockIn.data.entry.id), 'clock-in must persist in today view');
  const clockOut = await must('/time/clock', { method: 'POST', cookie: owner.cookie, body: { type: 'CLOCK_OUT', note: `${prefix} saída` } });
  const history = await must(`/time/history?from=${encodeURIComponent(new Date(Date.now() - 86400_000).toISOString())}&to=${encodeURIComponent(new Date(Date.now() + 1000).toISOString())}`, { cookie: owner.cookie });
  assert.ok(history.data.some((item) => item.id === clockOut.data.entry.id), 'clock-out must persist in history');

  const login = await must('/auth/login', { method: 'POST', body: { email: `${prefix.toLowerCase()}-a@example.invalid`, password } });
  assert.ok((await must('/auth/me', { cookie: login.cookie })).data.id === owner.id, 'registered test user must log in');
  await must('/auth/logout', { method: 'POST', cookie: login.cookie });
  const loggedOut = await request('/auth/me');
  assert.equal(loggedOut.response.status, 401, 'an unauthenticated request after logout must be rejected');

  const anonymous = createClient(supabaseUrl.origin, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const rls = await anonymous.from('activity_events').select('id').eq('company_id', owner.companyId);
  assert.ok(rls.error || rls.data?.length === 0, 'anonymous client must not read activity events');
  console.log(JSON.stringify({ status: 'passed', environment: 'Supabase hosted development project', projectRef, persistence: true, projects: true, subtasks: true, taskDelete: true, comments: true, dependencies: true, workspace: true, focus: true, calendar: true, privateCalendarIsolation: true, time: true, authLoginLogout: true, search: true, crossTenantApi: true, anonymousRls: true }));
} finally {
  for (const owner of owners) {
    await admin.auth.admin.deleteUser(owner.id).catch(() => {});
    await admin.from('companies').delete().eq('id', owner.companyId).then(() => undefined).catch(() => {});
  }
}
