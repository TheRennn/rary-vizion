'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth-provider';

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
    <main className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={onSubmit} className="glass w-full max-w-sm space-y-4 rounded-xl p-6">
        <div>
          <h1 className="text-xl font-semibold">Criar empresa</h1>
          <p className="text-sm text-muted">Você será o proprietário do workspace.</p>
        </div>
        <label className="block space-y-1 text-sm">
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
