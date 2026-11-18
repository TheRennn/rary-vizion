// Prepara o ambiente local: .env, SQLite, schema e seed. Idempotente.
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, appendFileSync } from 'node:fs';

const run = (cmd) => {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
};

function ensureEnv(target, example, requiredLine) {
  if (!existsSync(target)) copyFileSync(example, target);
  const key = requiredLine.split('=')[0];
  if (!readFileSync(target, 'utf8').includes(key)) appendFileSync(target, `\n${requiredLine}\n`);
}

ensureEnv('apps/api/.env', 'apps/api/.env.example', 'DEV_AUTO_LOGIN="true"');
ensureEnv('apps/web/.env.local', 'apps/web/.env.example', 'NEXT_PUBLIC_DEV_AUTO_LOGIN="true"');

run('npx prisma generate --schema apps/api/prisma/schema.prisma');
// db push: não interativo, ideal para desenvolvimento. Use "migrate" quando for versionar o schema.
run('npm run db:push -w apps/api');
run('npm run db:seed -w apps/api');

console.log('\nPronto. Rode: npm run dev  (web em http://localhost:3000, API em http://localhost:3333/api/health)');
