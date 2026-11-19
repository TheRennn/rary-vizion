'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth-provider';
import { BrandIcon } from '@/components/brand-icon';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      await register({
        companyName: String(form.get('companyName')),
        name: String(form.get('name')),
        email: String(form.get('email')),
        password: String(form.get('password')),
      });
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar conta');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      <div className="absolute left-[-12rem] top-[-10rem] h-[30rem] w-[30rem] rounded-full bg-primary/10 blur-[100px]" />
      <div className="absolute bottom-[-12rem] right-[-8rem] h-[26rem] w-[26rem] rounded-full bg-blue-500/10 blur-[100px]" />
      <form onSubmit={onSubmit} className="glass relative w-full max-w-md space-y-4 rounded-3xl p-7 shadow-[0_30px_100px_rgba(0,0,0,.35)] sm:p-8">
        <div className="mb-2 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-primary/20 bg-surface2">
            <BrandIcon size={36} className="h-9 w-9 object-contain" />
          </div>
          <div><p className="font-semibold">RARY Vizion</p><p className="text-xs text-muted">Novo workspace</p></div>
        </div>
        <div>
          <p className="eyebrow mb-2">Comece agora</p>
          <h1 className="text-2xl font-semibold tracking-tight">Criar empresa</h1>
          <p className="mt-1 text-sm text-muted">Você será o proprietário do workspace.</p>
        </div>
        <label className="block space-y-2 text-sm font-medium">
          Nome da empresa
          <input name="companyName" required minLength={2} maxLength={80} className="input" />
        </label>
        <label className="block space-y-1 text-sm">
          Seu nome
          <input name="name" required minLength={2} maxLength={80} autoComplete="name" className="input" />
        </label>
        <label className="block space-y-1 text-sm">
          E-mail
          <input name="email" type="email" required autoComplete="email" className="input" />
        </label>
        <label className="block space-y-1 text-sm">
          Senha (mínimo 8 caracteres)
          <input name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" className="input" />
        </label>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <button className="btn w-full" disabled={submitting}>
          {submitting ? 'Criando…' : 'Criar empresa'}
        </button>
        <p className="text-center text-sm text-muted">
          Já tem conta? <Link href="/login" className="text-primary hover:underline">Entrar</Link>
        </p>
      </form>
    </main>
  );
}
