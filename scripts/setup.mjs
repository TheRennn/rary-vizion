// Prepara os arquivos de ambiente para o Supabase. Idempotente.
import { copyFileSync, existsSync, readFileSync, appendFileSync } from 'node:fs';

function ensureEnv(target, example, requiredLine) {
  if (!existsSync(target)) copyFileSync(example, target);
  const key = requiredLine.split('=')[0];
  if (!readFileSync(target, 'utf8').includes(key)) appendFileSync(target, `\n${requiredLine}\n`);
}

ensureEnv('apps/api/.env', 'apps/api/.env.example', 'DEV_AUTO_LOGIN="true"');
ensureEnv('apps/web/.env.local', 'apps/web/.env.example', 'NEXT_PUBLIC_DEV_AUTO_LOGIN="true"');

console.log('\nConfigure as variáveis Supabase nos arquivos .env.');
console.log('Execute supabase/migrations/20261119000000_initial.sql no SQL Editor do Supabase.');
console.log('Depois rode: npm run dev');
