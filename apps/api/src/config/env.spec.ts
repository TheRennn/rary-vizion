import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateEnv } from './env';

const validConfig = {
  DATABASE_URL: 'file:./dev.db',
  JWT_SECRET: 'a-valid-secret-with-more-than-16-characters',
};

test('usa configuração válida e permite a expiração padrão', () => {
  assert.equal(validateEnv(validConfig), validConfig);
  assert.equal(validateEnv({ ...validConfig, JWT_EXPIRES_IN: '15m' }).JWT_EXPIRES_IN, '15m');
});

test('rejeita duração de token inválida', () => {
  assert.throws(
    () => validateEnv({ ...validConfig, JWT_EXPIRES_IN: '0h' }),
    /JWT_EXPIRES_IN deve ser uma duração positiva/,
  );
  assert.throws(
    () => validateEnv({ ...validConfig, JWT_EXPIRES_IN: 'infinite' }),
    /JWT_EXPIRES_IN deve ser uma duração positiva/,
  );
});
