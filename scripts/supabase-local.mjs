import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (process.platform === 'win32') {
  console.error('Stack Supabase local desabilitada neste fluxo: no Windows ela exige runtime de containers. Use o projeto hosted dev isolado com `npm run supabase:dev`.');
  process.exit(2);
}

const [action, ...flags] = process.argv.slice(2);
const commands = {
  start: ['start'],
  stop: ['stop'],
  status: ['status'],
  reset: ['db', 'reset', '--local'],
};

if (!Object.hasOwn(commands, action)) {
  console.error('Uso: node scripts/supabase-local.mjs <start|stop|status|reset [--confirm-local-reset]>');
  process.exit(2);
}
if (action === 'reset' && (flags.length !== 1 || flags[0] !== '--confirm-local-reset')) {
  console.error('Reset recusado. Para apagar e recriar somente o banco local, passe --confirm-local-reset.');
  process.exit(2);
}
if (action !== 'reset' && flags.length) {
  console.error(`Argumentos extras não são aceitos para ${action}.`);
  process.exit(2);
}

const cliEntry = path.join(root, 'node_modules', 'supabase', 'dist', 'supabase.js');
const result = spawnSync(process.execPath, [cliEntry, ...(action === 'status' ? ['status', '-o', 'env'] : commands[action])], {
  cwd: root,
  encoding: 'utf8',
});
if (result.error?.code === 'ENOENT' || result.status === null && /supabase\.js/.test(result.stderr ?? '')) {
  console.error('Supabase CLI local não encontrada. Execute `npm install` na raiz do projeto. Iniciar a stack local exige runtime compatível; este comando não instala nem inicia runtimes.');
  process.exit(127);
}
if (result.error) {
  console.error(`Falha ao iniciar a Supabase CLI: ${result.error.message}`);
  process.exit(1);
}
const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
const redact = (value) => value
  .replace(/(\b(?:anon key|service_role key|secret(?: key)?|password|connection string)\s*:\s*).+/gi, '$1[redacted]')
  .replace(/^((?:SUPABASE_.*KEY|SERVICE_ROLE_KEY|JWT_SECRET|POSTGRES_PASSWORD)=).+$/gim, '$1[redacted]');
if (result.status === 0) {
  if (action === 'status') {
    const keys = [...output.matchAll(/^([A-Z0-9_]+)=/gm)].map((match) => match[1]);
    console.log(`Supabase local stack respondeu. Variáveis encontradas: ${keys.join(', ') || 'status OK'}. Valores de credenciais foram omitidos.`);
  } else {
    console.log(redact(output));
  }
} else {
  console.error(redact(output));
}
process.exit(result.status ?? 1);
