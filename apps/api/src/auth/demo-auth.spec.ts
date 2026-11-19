import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDemoToken, isDemoLogin, readDemoToken } from './demo-auth';

test('valida login de conta demo fixa', () => {
  assert.equal(isDemoLogin('owner@demo.com', 'Demo@12345'), true);
  assert.equal(isDemoLogin('owner@demo.com', 'senha-incorreta'), false);
});

test('gera sessão demo assinada e recupera o usuário', () => {
  const secret = 'teste-secreto';
  const token = createDemoToken('manager@demo.com', secret);
  const user = readDemoToken(token, secret);

  assert.equal(user?.email, 'manager@demo.com');
  assert.equal(user?.role, 'MANAGER');
});

test('rejeita sessão demo com assinatura diferente', () => {
  const token = createDemoToken('admin@demo.com', 'segredo-a');
  assert.equal(readDemoToken(token, 'segredo-b'), null);
});
