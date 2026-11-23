import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, 'apps', 'api', '.env.local');
try { await access(envFile); } catch {
  console.error('apps/api/.env.local não existe. Inicie o Supabase local e execute `npm run supabase:local:configure`.');
  process.exit(2);
}
const contents = await readFile(envFile, 'utf8');
const entries = Object.fromEntries(contents.split(/\r?\n/).flatMap((line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return [];
  const separator = trimmed.indexOf('=');
  return separator < 0 ? [] : [[trimmed.slice(0, separator), trimmed.slice(separator + 1)]];
}));
if (entries.SUPABASE_LOCAL !== 'true' || !entries.SUPABASE_URL) {
  console.error('API local recusada: .env.local precisa declarar SUPABASE_LOCAL=true e SUPABASE_URL.');
  process.exit(2);
}
const target = new URL(entries.SUPABASE_URL);
if (!['localhost', '127.0.0.1', '[::1]', '::1'].includes(target.hostname) || target.protocol !== 'http:') {
  console.error('API local recusada: SUPABASE_URL precisa ser loopback HTTP.');
  process.exit(2);
}

const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const child = spawn(command, ['run', 'start:dev', '-w', 'apps/api'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, ...entries, NODE_ENV: 'development', VIZION_API_ENV_FILE: envFile },
});
child.on('error', (error) => { console.error(`Não foi possível iniciar a API local: ${error.message}`); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
