import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateEnv } from './env';

const validConfig = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
};

test('usa configuração válida do Supabase', () => {
  assert.equal(validateEnv(validConfig), validConfig);
});

test('rejeita URL inválida do Supabase', () => {
  assert.throws(
    () => validateEnv({ SUPABASE_URL: 'inválida' }),
    /SUPABASE_URL deve ser uma URL válida/,
  );
});

test('permite iniciar sem Supabase para acessar contas demo', () => {
  assert.deepEqual(validateEnv({}), {});
});

test('rejeita configuração parcial do Supabase', () => {
  assert.throws(
    () => validateEnv({ SUPABASE_URL: 'https://example.supabase.co' }),
    /Configure SUPABASE_URL/,
  );
});

test('exige segredo forte fora do padrão de desenvolvimento em produção', () => {
  assert.throws(
    () => validateEnv({ NODE_ENV: 'production', JWT_SECRET: 'development-only-change-this-secret-before-deploying' }),
    /JWT_SECRET deve ter pelo menos 32 caracteres/,
  );
  assert.doesNotThrow(() => validateEnv({ NODE_ENV: 'production', JWT_SECRET: 'a-strong-production-secret-with-more-than-32-chars' }));
});
