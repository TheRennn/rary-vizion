// Prepara os arquivos de ambiente locais. Idempotente.
import { copyFileSync, existsSync, readFileSync, appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

function ensureEnv(target, example, requiredLine) {
  if (!existsSync(target)) copyFileSync(example, target);
  const key = requiredLine.split('=')[0];
  if (!readFileSync(target, 'utf8').includes(key)) appendFileSync(target, `\n${requiredLine}\n`);
}

ensureEnv('apps/api/.env', 'apps/api/.env.example', 'DEV_AUTO_LOGIN="true"');
ensureEnv('apps/api/.env', 'apps/api/.env.example', 'DATABASE_URL="file:./dev.db"');
ensureEnv('apps/api/.env', 'apps/api/.env.example', 'JWT_SECRET="development-only-change-this-secret-before-deploying"');
ensureEnv('apps/web/.env.local', 'apps/web/.env.example', 'NEXT_PUBLIC_DEV_AUTO_LOGIN="true"');

console.log('Preparando banco local e contas demo...');

const dbPush = spawnSync('npm', ['run', 'db:push', '-w', 'apps/api'], { stdio: 'inherit', shell: true });
if (dbPush.status !== 0) process.exit(dbPush.status ?? 1);

const dbSeed = spawnSync('npm', ['run', 'db:seed', '-w', 'apps/api'], { stdio: 'inherit', shell: true });
if (dbSeed.status !== 0) process.exit(dbSeed.status ?? 1);

console.log('\nContas demo prontas. Senha fixa: Demo@12345');
