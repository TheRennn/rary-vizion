'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, api, AUTH_EXPIRED_EVENT } from '@/lib/api';
import type { AuthUser } from '@/lib/types';

interface RegisterInput {
  companyName: string;
  name: string;
  email: string;
  password: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  can: (module: string, action: string) => boolean;
  loading: boolean;
  /** Preenchido quando a API está inacessível (status 0). */
  apiOffline: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Padrão de desenvolvimento. Defina NEXT_PUBLIC_DEV_AUTO_LOGIN=false para exigir login.
const DEV_AUTO_LOGIN = process.env.NEXT_PUBLIC_DEV_AUTO_LOGIN !== 'false';
const SESSION_REFRESH_MS = 50 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<Array<{ module: string; action: string; enabled: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [apiOffline, setApiOffline] = useState<string | null>(null);

  useEffect(() => {
    window.localStorage.removeItem('vizion.token');
  }, []);

  useEffect(() => {
    const handleExpiredSession = () => {
      setUser(null);
      setPermissions([]);
      setApiOffline(null);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession);
  }, []);

  const authenticate = useCallback(async () => {
    const [authenticatedUser, effectivePermissions] = await Promise.all([
      api<AuthUser>('/auth/me'),
      api<Array<{ module: string; action: string; enabled: boolean }>>('/permissions/me'),
    ]);
    setUser(authenticatedUser);
    setPermissions(effectivePermissions);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        if (process.env.NODE_ENV !== 'production' && window.location.pathname === '/demo') return;
        try {
          await api('/auth/refresh', { method: 'POST' });
          await authenticate();
          return;
        } catch (e) {
          if (e instanceof ApiError && e.status === 0) throw e;
        }
        if (DEV_AUTO_LOGIN) {
          await api('/auth/dev-login', { method: 'POST' });
          await authenticate();
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 0) setApiOffline(e.message);
        // Demais erros (ex.: dev-login desabilitado) caem na tela de login normal.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [authenticate]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(() => {
      void api('/auth/refresh', { method: 'POST' }).catch(() => window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT)));
    }, SESSION_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [user]);

  const login = useCallback(
    async (email: string, password: string) => {
      await api('/auth/login', { method: 'POST', body: { email, password } });
      await authenticate();
    },
    [authenticate],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      await api('/auth/register', { method: 'POST', body: input });
      await authenticate();
    },
    [authenticate],
  );

  const logout = useCallback(async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* clear local state even if API is unreachable */ }
    setUser(null);
    setPermissions([]);
  }, []);

  const can = useCallback((module: string, action: string) => permissions.some((permission) => permission.module === module && permission.action === action && permission.enabled), [permissions]);

  const value = useMemo(
    () => ({ user, can, loading, apiOffline, login, register, logout }),
    [user, can, loading, apiOffline, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
