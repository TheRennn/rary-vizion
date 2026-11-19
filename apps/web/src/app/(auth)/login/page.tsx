'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth-provider';
import { BrandIcon } from '@/components/brand-icon';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const demoAccounts = [
    ['Super Admin', 'superadmin@demo.com'],
    ['Owner', 'owner@demo.com'],
    ['Admin', 'admin@demo.com'],
    ['Manager', 'manager@demo.com'],
    ['Team Leader', 'teamleader@demo.com'],
    ['Developer', 'developer@demo.com'],
    ['Guest', 'guest@demo.com'],
  ] as const;

  async function loginDemo(email: string) {
    setSubmitting(true);
    setError(null);
    try {
      await login(email, 'Demo@12345');
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao entrar');
    } finally {
      setSubmitting(false);
    }
  }

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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      <div className="absolute left-[-12rem] top-[-10rem] h-[30rem] w-[30rem] rounded-full bg-primary/10 blur-[100px]" />
      <div className="absolute bottom-[-12rem] right-[-8rem] h-[26rem] w-[26rem] rounded-full bg-blue-500/10 blur-[100px]" />
      <form onSubmit={onSubmit} className="glass relative w-full max-w-md space-y-5 rounded-3xl p-7 shadow-[0_30px_100px_rgba(0,0,0,.35)] sm:p-8">
        <div className="mb-2 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-primary/20 bg-surface2">
            <BrandIcon size={36} className="h-9 w-9 object-contain" />
          </div>
          <div>
            <p className="font-semibold">RARY Vizion</p>
            <p className="text-xs text-muted">Workspace corporativo</p>
          </div>
        </div>
        <div>
          <p className="eyebrow mb-2">Acesso seguro</p>
          <h1 className="text-2xl font-semibold tracking-tight">Bem-vindo de volta</h1>
          <p className="mt-1 text-sm text-muted">Use o e-mail da sua empresa.</p>
        </div>
        <label className="block space-y-2 text-sm font-medium">
          E-mail
          <input name="email" type="email" required autoComplete="email" className="input" />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Senha
          <input name="password" type="password" required autoComplete="current-password" className="input" />
        </label>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <button className="btn w-full" disabled={submitting}>
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
        <div className="space-y-2 border-t border-line pt-4">
          <p className="text-xs font-medium text-muted">Contas de teste — senha: <code>Demo@12345</code></p>
          <div className="grid grid-cols-2 gap-2">
            {demoAccounts.map(([label, email]) => (
              <button
                key={email}
                type="button"
                className="btn-ghost text-xs"
                disabled={submitting}
                onClick={() => void loginDemo(email)}
                title={email}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-center text-sm text-muted">
          Sua empresa ainda não usa o Vizion?{' '}
          <Link href="/register" className="text-primary hover:underline">Criar conta</Link>
        </p>
      </form>
    </main>
  );
}
