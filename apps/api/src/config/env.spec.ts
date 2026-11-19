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

test('rejeita configuração incompleta do Supabase', () => {
  assert.throws(
    () => validateEnv({ SUPABASE_URL: 'inválida' }),
    /SUPABASE_URL é obrigatório/,
  );
});
