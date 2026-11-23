import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'supabase', 'migrations');
const expected = [
  '20261119000000_initial.sql',
  '20261119000100_service_role_grants.sql',
  '20261121000100_supabase_runtime_modules.sql',
  '20261122000100_projects_3.sql',
  '20261122000200_workspace_focus_calendar.sql',
  '20261123000100_sprint16_activity_gantt.sql',
];
const files = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
assert.deepEqual(files, expected, 'Migration names/order differ from the reviewed local chain');

const sql = await Promise.all(files.map((name) => readFile(path.join(directory, name), 'utf8')));
const all = sql.join('\n');
for (const destructive of [/\bdrop\s+(table|schema|column)\b/i, /\btruncate\s+/i, /\bdelete\s+from\b/i]) {
  assert.doesNotMatch(all, destructive, `Unexpected destructive statement: ${destructive}`);
}

const requiredTables = [
  'companies', 'departments', 'users', 'time_entries', 'audit_logs', 'conversations',
  'conversation_participants', 'chat_messages', 'projects', 'project_tasks', 'meetings',
  'meeting_participants', 'notifications', 'permission_grants', 'project_task_comments',
  'project_task_dependencies', 'workspace_preferences', 'focus_sessions', 'calendar_events', 'activity_events',
];
for (const table of requiredTables) {
  assert.match(all, new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${table}\\b`, 'i'), `Missing CREATE TABLE contract: ${table}`);
  assert.match(all, new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, 'i'), `RLS is not enabled: ${table}`);
}
assert.match(all, /create\s+or\s+replace\s+function\s+public\.handle_new_auth_user/i, 'Auth profile trigger function missing');
assert.match(all, /create\s+trigger\s+on_auth_user_created/i, 'Auth profile trigger missing');
assert.match(all, /grant\s+execute\s+on\s+function\s+public\.record_time_entry\s*\([^;]+\)\s+to\s+service_role/i, 'Time RPC must be restricted to the backend service role');

const webFiles = await readdir(path.join(root, 'apps', 'web', 'src'), { recursive: true });
for (const name of webFiles.filter((item) => /\.(ts|tsx|js|jsx)$/.test(item))) {
  const contents = await readFile(path.join(root, 'apps', 'web', 'src', name), 'utf8');
  assert.doesNotMatch(contents, /SUPABASE_SECRET_KEY|service_role/i, `Backend secret marker found in frontend source: ${name}`);
}

console.log(JSON.stringify({ status: 'passed', migrations: files, requiredTables: requiredTables.length, destructiveStatements: 0, frontendServiceRoleScan: 'passed' }, null, 2));
