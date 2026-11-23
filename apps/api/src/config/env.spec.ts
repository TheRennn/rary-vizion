import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateEnv } from './env';

const supabase = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public', SUPABASE_SECRET_KEY: 'secret' };

test('requires Supabase credentials and does not require a separate database URL', () => {
  assert.deepEqual(validateEnv(supabase), supabase);
  assert.throws(() => validateEnv({}), /SUPABASE_URL é obrigatório/);
});

test('accepts only an explicitly enabled Supabase loopback URL outside production', () => {
  const local = { ...supabase, SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_LOCAL: 'true', NODE_ENV: 'development' };
  assert.deepEqual(validateEnv(local), local);
  assert.throws(() => validateEnv({ ...local, SUPABASE_LOCAL: 'false' }), /loopback HTTP explicitamente habilitado/);
  assert.throws(() => validateEnv({ ...local, NODE_ENV: 'production' }), /loopback HTTP explicitamente habilitado/);
  assert.throws(() => validateEnv({ ...local, SUPABASE_URL: 'https://example.supabase.co' }), /loopback HTTP explicitamente habilitado/);
  assert.throws(() => validateEnv({ ...local, SUPABASE_URL: 'http://192.168.1.10:54321' }), /loopback HTTP explicitamente habilitado/);
});

test('development target requires the exact project ref from its HTTPS URL', () => {
  const development = { ...supabase, SUPABASE_URL: 'https://qrfqmebjgovrnqytvshf.supabase.co', SUPABASE_ENVIRONMENT: 'development', SUPABASE_PROJECT_REF: 'qrfqmebjgovrnqytvshf' };
  assert.equal(validateEnv(development).SUPABASE_PROJECT_REF, 'qrfqmebjgovrnqytvshf');
  assert.throws(() => validateEnv({ ...development, SUPABASE_PROJECT_REF: 'anotherprojectref12345' }), /Configuração inválida/);
});

test('accepts Supabase and shared Redis with TLS in production', () => {
  assert.doesNotThrow(() => validateEnv({ ...supabase, NODE_ENV: 'production', CORS_ORIGIN: 'https://app.example.com', RATE_LIMIT_REDIS_URL: 'https://redis.example', RATE_LIMIT_REDIS_TOKEN: 'token' }));
});

test('requires production Redis TLS and allows local development fallback', () => {
  assert.doesNotThrow(() => validateEnv({ ...supabase, NODE_ENV: 'development', RATE_LIMIT_REDIS_URL: 'redis://:vizion_dev_only@localhost:6379' }));
  assert.throws(() => validateEnv({ ...supabase, NODE_ENV: 'production', CORS_ORIGIN: 'https://app.example.com' }), /RATE_LIMIT_REDIS_URL com TLS é obrigatório/);
});
