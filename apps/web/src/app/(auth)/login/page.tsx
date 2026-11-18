'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth-provider';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      await login(String(form.get('email')), String(form.get('password')));
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao entrar');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={onSubmit} className="glass w-full max-w-sm space-y-4 rounded-xl p-6">
        <div>
          <h1 className="text-xl font-semibold">Entrar no Vizion</h1>
          <p className="text-sm text-muted">Use o e-mail da sua empresa.</p>
        </div>
        <label className="block space-y-1 text-sm">
          E-mail
          <input name="email" type="email" required autoComplete="email" className="input" />
        </label>
        <label className="block space-y-1 text-sm">
          Senha
          <input name="password" type="password" required autoComplete="current-password" className="input" />
        </label>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <button className="btn w-full" disabled={submitting}>
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="text-center text-sm text-muted">
          Sua empresa ainda não usa o Vizion?{' '}
          <Link href="/register" className="text-primary hover:underline">Criar conta</Link>
        </p>
      </form>
    </main>
  );
}
