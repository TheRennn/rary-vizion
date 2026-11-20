const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';
const TOKEN_KEY = 'vizion.token';
const API_TIMEOUT_MS = 15_000;
export const AUTH_EXPIRED_EVENT = 'vizion:auth-expired';
const PUBLIC_AUTH_PATHS = new Set(['/auth/login', '/auth/register', '/auth/dev-login']);

// Atenção: localStorage é simples para começar, mas exposto a XSS.
// Para produção, migre para cookie httpOnly emitido pela API.
export const tokenStorage = {
  get: (): string | null => (typeof window === 'undefined' ? null : window.localStorage.getItem(TOKEN_KEY)),
  set: (token: string) => window.localStorage.setItem(TOKEN_KEY, token),
  clear: () => window.localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

export async function api<T>(path: string, { method = 'GET', body }: ApiOptions = {}): Promise<T> {
  const token = tokenStorage.get();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(`${API_URL}${path}`, {
        method,
        headers: {
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) {
        throw new ApiError(0, 'A API não respondeu em até 15 segundos.');
      }
      throw new ApiError(0, 'Não foi possível conectar à API. Ela está rodando?');
    }

    if (!res.ok) {
      if (
        res.status === 401 &&
        token &&
        !PUBLIC_AUTH_PATHS.has(path) &&
        typeof window !== 'undefined'
      ) {
        tokenStorage.clear();
        window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
      }

      let message = `Erro ${res.status}`;
      try {
        const data = (await res.json()) as { message?: string | string[] };
        if (data.message) message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
      } catch {
        if (controller.signal.aborted) {
          throw new ApiError(0, 'A API não respondeu em até 15 segundos.');
        }
        /* corpo sem JSON */
      }
      throw new ApiError(res.status, message);
    }

    try {
      return (await res.json()) as T;
    } catch (error) {
      if (controller.signal.aborted) {
        throw new ApiError(0, 'A API não respondeu em até 15 segundos.');
      }
      throw error;
    }
  } finally {
    clearTimeout(timeoutId);
  }
}
