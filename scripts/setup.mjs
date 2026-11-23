// Idempotent local setup: preserve existing env files and never touch local legacy data.
import { copyFileSync, existsSync, readFileSync } from 'node:fs';

function ensureEnv(target, example) {
  if (!existsSync(target)) copyFileSync(example, target);
}

ensureEnv('apps/api/.env', 'apps/api/.env.example');
ensureEnv('apps/web/.env.local', 'apps/web/.env.example');

const values = Object.fromEntries(readFileSync('apps/api/.env', 'utf8').split(/\r?\n/)
  .filter((line) => line.trim() && !line.trim().startsWith('#'))
  .map((line) => { const index = line.indexOf('='); return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')]; }));

for (const key of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY']) {
  if (!values[key] || values[key].includes('SEU-PROJETO') || values[key].includes('sb_secret_...') || values[key].includes('sb_publishable_...')) {
    console.error(`Configure ${key} em apps/api/.env com os dados de Project Settings > API do Supabase.`);
    process.exit(1);
  }
}

try {
  const response = await fetch(`${values.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/companies?select=id&limit=1`, {
    headers: { apikey: values.SUPABASE_SECRET_KEY, Authorization: `Bearer ${values.SUPABASE_SECRET_KEY}` },
  });
  if (!response.ok) {
    console.error(`O Supabase respondeu HTTP ${response.status}. Confira a URL e a chave secreta configuradas.`);
    process.exit(1);
  }
} catch {
  console.error('Não foi possível alcançar o Supabase. Confira a conexão de rede e SUPABASE_URL.');
  process.exit(1);
}

console.log('Supabase conectado. O setup preservou os arquivos .env e os dados locais existentes.');
try {
  const response = await fetch(`${values.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/`, {
    headers: { apikey: values.SUPABASE_SECRET_KEY, Authorization: `Bearer ${values.SUPABASE_SECRET_KEY}`, Accept: 'application/openapi+json' },
  });
  const openapi = await response.json();
  const paths = new Set(Object.keys(openapi.paths ?? {}));
  const required = ['/projects', '/project_tasks', '/meetings', '/meeting_participants', '/notifications', '/permission_grants', '/rpc/record_time_entry'];
  const missing = required.filter((path) => !paths.has(path));
  if (missing.length) {
    console.warn(`Migration Supabase pendente (recursos ausentes: ${missing.join(', ')}). Aplique supabase/migrations/20261121000100_supabase_runtime_modules.sql pelo SQL Editor do projeto.`);
  } else {
    console.log('Schema Supabase dos módulos adicionais já está aplicado.');
  }
} catch {
  console.warn('Supabase conectado; não foi possível verificar se as migrations dos módulos adicionais já foram aplicadas.');
}
