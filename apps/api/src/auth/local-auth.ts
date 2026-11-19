import { createHmac, timingSafeEqual } from 'crypto';

const TOKEN_LIFETIME_SECONDS = 8 * 60 * 60;

function encode(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function createLocalToken(userId: string, secret: string): string {
  const payload = encode({ sub: userId, iss: 'rary-local', exp: Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS });
  const signature = createHmac('sha256', secret).update(payload).digest();
  return `local.${payload}.${signature.toString('base64url')}`;
}

export function readLocalToken(token: string, secret: string): { userId: string } | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'local') return null;
  const actual = Buffer.from(parts[2], 'base64url');
  const expected = createHmac('sha256', secret).update(parts[1]).digest();
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const data = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { sub?: string; iss?: string; exp?: number };
    if (!data.sub || data.iss !== 'rary-local' || !data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return { userId: data.sub };
  } catch {
    return null;
  }
}
