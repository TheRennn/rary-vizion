import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, 'apps', 'api', '.env.dev.local');
try { await access(envFile); } catch {
  console.error('apps/api/.env.dev.local não existe. Execute `npm run supabase:dev:configure -- --project-ref=<ref>` após autorizar o projeto.');
  process.exit(2);
}
const entries = Object.fromEntries((await readFile(envFile, 'utf8')).split(/\r?\n/).flatMap((line) => {
  const current = line.trim();
  if (!current || current.startsWith('#')) return [];
  const separator = current.indexOf('=');
  return separator < 0 ? [] : [[current.slice(0, separator), current.slice(separator + 1)]];
}));
let target;
try { target = new URL(entries.SUPABASE_URL ?? ''); } catch { target = null; }
const ref = target?.hostname.endsWith('.supabase.co') ? target.hostname.slice(0, -'.supabase.co'.length) : '';
if (entries.SUPABASE_ENVIRONMENT !== 'development' || !/^[a-z0-9]{20}$/.test(entries.SUPABASE_PROJECT_REF ?? '') || ref !== entries.SUPABASE_PROJECT_REF || target?.protocol !== 'https:') {
  console.error('API recusada: .env.dev.local precisa identificar um projeto Supabase HTTPS de desenvolvimento cujo ref corresponda ao URL.');
  process.exit(2);
}

const childEnv = { ...process.env, ...entries, NODE_ENV: 'development', VIZION_API_ENV_FILE: envFile };
delete childEnv.SUPABASE_ACCESS_TOKEN;
delete childEnv.SUPABASE_DB_PASSWORD;
const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const child = spawn(command, ['run', 'start:dev', '-w', 'apps/api'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: childEnv,
});
child.on('error', (error) => { console.error(`Não foi possível iniciar a API dev: ${error.message}`); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
