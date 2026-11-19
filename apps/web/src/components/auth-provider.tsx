'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, api, AUTH_EXPIRED_EVENT, tokenStorage } from '@/lib/api';
import type { AuthUser } from '@/lib/types';

interface RegisterInput {
  companyName: string;
  name: string;
  email: string;
  password: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  /** Preenchido quando a API está inacessível (status 0). */
  apiOffline: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Padrão de desenvolvimento. Defina NEXT_PUBLIC_DEV_AUTO_LOGIN=false para exigir login.
const DEV_AUTO_LOGIN = process.env.NEXT_PUBLIC_DEV_AUTO_LOGIN !== 'false';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiOffline, setApiOffline] = useState<string | null>(null);

  useEffect(() => {
    const handleExpiredSession = () => {
      setUser(null);
      setApiOffline(null);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession);
  }, []);

  const authenticate = useCallback(async (accessToken: string) => {
    tokenStorage.set(accessToken);
    setUser(await api<AuthUser>('/auth/me'));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        if (tokenStorage.get()) {
          try {
            setUser(await api<AuthUser>('/auth/me'));
            return;
          } catch (e) {
            if (e instanceof ApiError && e.status === 0) throw e;
            tokenStorage.clear(); // token expirado/inválido
          }
        }
        if (DEV_AUTO_LOGIN) {
          const res = await api<{ accessToken: string }>('/auth/dev-login', { method: 'POST' });
          await authenticate(res.accessToken);
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

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api<{ accessToken: string }>('/auth/login', { method: 'POST', body: { email, password } });
      await authenticate(res.accessToken);
    },
    [authenticate],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const res = await api<{ accessToken: string }>('/auth/register', { method: 'POST', body: input });
      await authenticate(res.accessToken);
    },
    [authenticate],
  );

  const logout = useCallback(() => {
    tokenStorage.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, apiOffline, login, register, logout }),
    [user, loading, apiOffline, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
