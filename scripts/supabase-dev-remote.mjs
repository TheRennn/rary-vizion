import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, 'apps', 'api', '.env.dev.local');
const [action, ...flags] = process.argv.slice(2);
if (!['projects', 'migrations', 'dry-run', 'push'].includes(action)) {
  console.error('Uso: npm run supabase:dev -- <projects|migrations|dry-run|push [--confirm-dev-write]>');
  process.exit(2);
}
const values = Object.fromEntries((await readFile(envFile, 'utf8').catch(() => '')).split(/\r?\n/).flatMap((line) => {
  const current = line.trim();
  if (!current || current.startsWith('#')) return [];
  const index = current.indexOf('=');
  return index > 0 ? [[current.slice(0, index), current.slice(index + 1)]] : [];
}));
let url;
try { url = new URL(values.SUPABASE_URL ?? ''); } catch { url = null; }
const projectRef = values.SUPABASE_PROJECT_REF;
if (!url || url.protocol !== 'https:' || !/^[a-z0-9]{20}$/.test(projectRef ?? '') || url.hostname !== `${projectRef}.supabase.co` || values.SUPABASE_ENVIRONMENT !== 'development') {
  console.error('Recusado: configure primeiro apps/api/.env.dev.local com SUPABASE_ENVIRONMENT=development e project ref correspondente.');
  process.exit(2);
}
if (!values.SUPABASE_ACCESS_TOKEN) {
  console.error('Adicione SUPABASE_ACCESS_TOKEN a apps/api/.env.dev.local sem compartilhá-lo pelo chat.');
  process.exit(2);
}
if (action === 'push' && (!flags.includes('--confirm-dev-write') || flags.some((flag) => flag !== '--confirm-dev-write'))) {
  console.error('Push remoto recusado. Confirme o projeto dev autorizado com --confirm-dev-write.');
  process.exit(2);
}
if (action !== 'push' && flags.length) {
  console.error(`Argumentos extras não são aceitos para ${action}.`);
  process.exit(2);
}
if (['migrations', 'dry-run', 'push'].includes(action) && !values.SUPABASE_DB_PASSWORD) {
  console.error('Adicione SUPABASE_DB_PASSWORD a apps/api/.env.dev.local sem compartilhá-la pelo chat.');
  process.exit(2);
}

const args = action === 'projects' ? ['projects', 'list']
  : action === 'migrations' ? ['migration', 'list', `--remote=${projectRef}`]
    : ['db', 'push', ...(action === 'dry-run' ? ['--dry-run'] : []), `--remote=${projectRef}`];
const childEnv = { ...process.env, SUPABASE_ACCESS_TOKEN: values.SUPABASE_ACCESS_TOKEN };
if (values.SUPABASE_DB_PASSWORD) childEnv.SUPABASE_DB_PASSWORD = values.SUPABASE_DB_PASSWORD;
if (action === 'push') childEnv.SUPABASE_YES = 'true';
const cliEntry = path.join(root, 'node_modules', 'supabase', 'dist', 'supabase.js');
const result = spawnSync(process.execPath, [cliEntry, ...args], { cwd: root, encoding: 'utf8', env: childEnv, maxBuffer: 20 * 1024 * 1024 });
if (result.error) console.error(`Não foi possível iniciar a CLI: ${result.error.message}`);
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 1);
