import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (process.platform === 'win32') {
  console.error('Configuração Supabase local desabilitada neste fluxo Windows sem containers. Use `npm run supabase:dev:configure` para o projeto hosted dev autorizado.');
  process.exit(2);
}
const target = path.join(root, 'apps', 'api', '.env.local');
const overwrite = process.argv.includes('--overwrite-local');
const cliEntry = path.join(root, 'node_modules', 'supabase', 'dist', 'supabase.js');
const result = spawnSync(process.execPath, [cliEntry, 'status', '-o', 'env'], { cwd: root, encoding: 'utf8' });
if (result.error?.code === 'ENOENT') {
  console.error('Supabase CLI local não encontrada. Execute `npm install` na raiz do projeto.');
  process.exit(127);
}
if (result.status !== 0) {
  console.error('Não foi possível ler a configuração do Supabase local. Inicie o stack com `npm run supabase:local -- start`.');
  process.exit(result.status ?? 1);
}

const values = {};
for (const line of (result.stdout ?? '').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!match) continue;
  const raw = match[2].trim();
  values[match[1]] = raw.replace(/^(['"])(.*)\1$/, '$2');
}
const url = values.API_URL ?? values.SUPABASE_URL;
const publicKey = values.PUBLISHABLE_KEY ?? values.ANON_KEY ?? values.SUPABASE_PUBLISHABLE_KEY;
const secretKey = values.SECRET_KEY ?? values.SERVICE_ROLE_KEY ?? values.SUPABASE_SECRET_KEY;
if (!url || !publicKey || !secretKey) {
  console.error('O status do Supabase local não forneceu API_URL e as duas chaves locais esperadas. Nenhuma configuração foi gravada.');
  process.exit(1);
}
const parsed = new URL(url);
if (!['localhost', '127.0.0.1', '[::1]', '::1'].includes(parsed.hostname) || parsed.protocol !== 'http:') {
  console.error('Configuração recusada: a URL fornecida pela CLI não é loopback HTTP. Nenhuma configuração foi gravada.');
  process.exit(1);
}

if (!overwrite) {
  try {
    await (await import('node:fs/promises')).access(target);
    console.error('apps/api/.env.local já existe; recusando sobrescrever. Use --overwrite-local para substituí-lo.');
    process.exit(2);
  } catch { /* arquivo ainda não existe */ }
}

await mkdir(path.dirname(target), { recursive: true });
const content = [
  '# Gerado pelo Supabase CLI local; não compartilhe nem versione.',
  'NODE_ENV=development',
  'SUPABASE_LOCAL=true',
  `SUPABASE_URL=${url}`,
  `SUPABASE_PUBLISHABLE_KEY=${publicKey}`,
  `SUPABASE_SECRET_KEY=${secretKey}`,
  'PORT=3333',
  'DEV_AUTO_LOGIN=false',
  'CORS_ORIGIN=http://localhost:3000',
  '',
].join('\n');
await writeFile(target, content, { encoding: 'utf8', mode: 0o600 });
console.log('apps/api/.env.local criado com credenciais obtidas do Supabase loopback. Os valores não foram impressos.');
