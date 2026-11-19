import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLocalToken, readLocalToken } from './local-auth';

const secret = 'test-secret-with-enough-entropy-for-unit-tests';

test('creates and verifies a signed local session token', () => {
  const token = createLocalToken('10000000-0000-4000-8000-000000000001', secret);
  assert.deepEqual(readLocalToken(token, secret), { userId: '10000000-0000-4000-8000-000000000001' });
});

test('rejects tampered or wrongly signed local session tokens', () => {
  const token = createLocalToken('10000000-0000-4000-8000-000000000001', secret);
  const parts = token.split('.');
  assert.equal(readLocalToken(`${parts[0]}.${parts[1]}.invalid`, secret), null);
  assert.equal(readLocalToken(token, 'another-secret'), null);
});
