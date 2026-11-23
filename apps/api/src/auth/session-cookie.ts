import { Request } from 'express';

export const SESSION_COOKIE = 'rary_session';
export const REFRESH_COOKIE = 'rary_refresh';
export const SESSION_COOKIE_PATH = '/api';

export function readSessionCookie(request: Request): string | null {
  const header = request.headers.cookie;
  if (!header) return null;
  const item = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (!item) return null;
  try { return decodeURIComponent(item.slice(SESSION_COOKIE.length + 1)); } catch { return null; }
}

export function readRefreshCookie(request: Request): string | null {
  const item = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${REFRESH_COOKIE}=`));
  if (!item) return null;
  try { return decodeURIComponent(item.slice(REFRESH_COOKIE.length + 1)); } catch { return null; }
}
