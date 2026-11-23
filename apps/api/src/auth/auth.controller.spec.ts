import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuthController } from './auth.controller';
import { REFRESH_COOKIE, SESSION_COOKIE } from './session-cookie';

test('login envia cookie HttpOnly e não retorna o token ao cliente', async () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const cookies: unknown[][] = [];
    const controller = new AuthController({ login: async () => ({ token: 'opaque-secret', expiresAt: new Date('2030-01-01T00:00:00Z') }) } as any);
    const body = await controller.login({ email: 'a@example.com', password: 'password' }, { cookie: (...args: unknown[]) => { cookies.push(args); } } as any);
    assert.deepEqual(body, { authenticated: true });
    assert.deepEqual(cookies.map(([name]) => name), [SESSION_COOKIE, REFRESH_COOKIE]);
    for (const [, , options] of cookies) {
      assert.equal((options as any).httpOnly, true);
      assert.equal((options as any).secure, true);
      assert.equal((options as any).sameSite, 'lax');
      assert.equal((options as any).path, '/api');
    }
  } finally {
    if (originalEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnv;
  }
});
