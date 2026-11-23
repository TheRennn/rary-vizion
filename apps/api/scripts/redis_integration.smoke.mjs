import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from 'redis';

const url = process.env.TEST_REDIS_URL;
if (!url) throw new Error('TEST_REDIS_URL is required');
const parsed = new URL(url);
if (!['redis:', 'rediss:'].includes(parsed.protocol) || !['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
  throw new Error('Refusing Redis integration test unless TEST_REDIS_URL points to a loopback test server');
}

const options = { url, socket: { connectTimeout: 3_000, reconnectStrategy: false } };
const first = createClient(options);
const second = createClient(options);
first.on('error', () => {});
second.on('error', () => {});
const key = `rary:integration:${randomUUID()}`;

try {
  await Promise.all([first.connect(), second.connect()]);
  assert.equal(await first.ping(), 'PONG');
  const increment = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; return {n,redis.call('PTTL',KEYS[1])}";
  const one = await first.eval(increment, { keys: [key], arguments: ['60000'] });
  const two = await second.eval(increment, { keys: [key], arguments: ['60000'] });
  assert.equal(Number(one[0]), 1, 'first process starts the shared counter');
  assert.equal(Number(two[0]), 2, 'second process sees the shared counter');
  assert.ok(Number(two[1]) > 0 && Number(two[1]) <= 60_000, 'counter expires within its fixed window');
  await first.pExpire(key, 50);
  await new Promise((resolve) => setTimeout(resolve, 80));
  const afterExpiry = await second.eval(increment, { keys: [key], arguments: ['60000'] });
  assert.equal(Number(afterExpiry[0]), 1, 'expired counters restart at one');
  console.log(JSON.stringify({ status: 'passed', sharedCounter: true, expiry: true, clients: 2 }));
} finally {
  if (first.isReady) await first.del(key).catch(() => {});
  await Promise.all([first.isOpen ? first.close() : undefined, second.isOpen ? second.close() : undefined]);
}
