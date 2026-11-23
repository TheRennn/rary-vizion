const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';
const API_TIMEOUT_MS = 15_000;
export const AUTH_EXPIRED_EVENT = 'vizion:auth-expired';
const PUBLIC_AUTH_PATHS = new Set(['/auth/login', '/auth/register', '/auth/dev-login']);

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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(`${API_URL}${path}`, {
        method,
        credentials: 'include',
        headers: {
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
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
        !PUBLIC_AUTH_PATHS.has(path) &&
        typeof window !== 'undefined'
      ) {
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
