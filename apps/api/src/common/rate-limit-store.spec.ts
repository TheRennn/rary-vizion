import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConfigService } from '@nestjs/config';
import { RateLimitStore } from './rate-limit-store';

function config(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

test('Redis REST shared counter returns count and expiry', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: unknown;
  let authHeader = '';
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    authHeader = new Headers(init?.headers).get('Authorization') ?? '';
    return new Response(JSON.stringify({ result: [4, 25_000] }), { status: 200 });
  };
  try {
    const store = new RateLimitStore(config({ RATE_LIMIT_REDIS_URL: 'https://redis.example', RATE_LIMIT_REDIS_TOKEN: 'test-token' }));
    const result = await store.consume('rary:test:key', 60_000);
    assert.equal(result.count, 4);
    assert.ok(result.resetAt > Date.now() + 24_000);
    assert.equal(authHeader, 'Bearer test-token');
    assert.equal(Array.isArray(requestBody), true);
    assert.equal((requestBody as unknown[])[0], 'EVAL');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('configured Redis REST failure does not silently fall back', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('', { status: 503 });
  try {
    const store = new RateLimitStore(config({ RATE_LIMIT_REDIS_URL: 'https://redis.example', RATE_LIMIT_REDIS_TOKEN: 'test-token' }));
    await assert.rejects(store.consume('rary:test:key', 60_000), /Redis REST request failed/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('health check does not require Redis in local development', async () => {
  const store = new RateLimitStore(config({}));
  assert.equal(await store.health(), 'not-configured');
});

test('Redis REST health check sends PING and validates PONG', async () => {
  const originalFetch = globalThis.fetch;
  let command: unknown;
  globalThis.fetch = async (_input, init) => {
    command = JSON.parse(String(init?.body));
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer test-token');
    return new Response(JSON.stringify({ result: 'PONG' }), { status: 200 });
  };
  try {
    const store = new RateLimitStore(config({ RATE_LIMIT_REDIS_URL: 'https://redis.example', RATE_LIMIT_REDIS_TOKEN: 'test-token' }));
    assert.equal(await store.health(), 'ok');
    assert.deepEqual(command, ['PING']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
