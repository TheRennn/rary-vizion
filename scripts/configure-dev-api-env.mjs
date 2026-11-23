import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'apps', 'api', '.env');
const target = path.join(root, 'apps', 'api', '.env.dev.local');
const refArg = process.argv.find((arg) => arg.startsWith('--project-ref='));
const projectRef = refArg?.slice('--project-ref='.length);
const overwrite = process.argv.includes('--overwrite-dev-local');
if (!projectRef || !/^[a-z0-9]{20}$/.test(projectRef)) {
  console.error('Informe --project-ref=<ref de 20 caracteres> do projeto de desenvolvimento autorizado.');
  process.exit(2);
}
if (!overwrite) {
  try { await access(target); console.error('apps/api/.env.dev.local já existe; recusando sobrescrever. Use --overwrite-dev-local para substituí-lo.'); process.exit(2); }
  catch { /* não existe */ }
}

const values = Object.fromEntries((await readFile(source, 'utf8')).split(/\r?\n/).flatMap((line) => {
  const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!match) return [];
  return [[match[1], match[2].trim().replace(/^(['"])(.*)\1$/, '$2')]];
}));
let configuredRef;
try {
  const url = new URL(values.SUPABASE_URL ?? '');
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co')) throw new Error();
  configuredRef = url.hostname.slice(0, -'.supabase.co'.length);
} catch {
  console.error('SUPABASE_URL do .env não é um endpoint HTTPS de projeto Supabase. Nada foi gravado.');
  process.exit(1);
}
if (configuredRef !== projectRef) {
  console.error('O ref solicitado não coincide com o projeto em apps/api/.env. Nada foi gravado.');
  process.exit(1);
}
if (!values.SUPABASE_PUBLISHABLE_KEY || !values.SUPABASE_SECRET_KEY) {
  console.error('O .env operacional não contém as duas chaves API esperadas. Nada foi gravado.');
  process.exit(1);
}

const output = [
  '# Alvo de desenvolvimento Supabase; arquivo ignorado pelo Git.',
  '# SUPABASE_ACCESS_TOKEN e SUPABASE_DB_PASSWORD são opcionais para a API, mas necessários para CLI remota.',
  'NODE_ENV=development',
  'SUPABASE_ENVIRONMENT=development',
  `SUPABASE_PROJECT_REF=${projectRef}`,
  `SUPABASE_URL=${values.SUPABASE_URL}`,
  `SUPABASE_PUBLISHABLE_KEY=${values.SUPABASE_PUBLISHABLE_KEY}`,
  `SUPABASE_SECRET_KEY=${values.SUPABASE_SECRET_KEY}`,
  'PORT=3333',
  'DEV_AUTO_LOGIN=false',
  'CORS_ORIGIN=http://localhost:3000',
  '',
].join('\n');
await writeFile(target, output, { encoding: 'utf8', mode: 0o600 });
console.log('apps/api/.env.dev.local criado. O ref corresponde ao alvo autorizado; valores de chaves foram omitidos.');
