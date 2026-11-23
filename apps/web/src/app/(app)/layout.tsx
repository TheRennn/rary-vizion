'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/components/auth-provider';
import { AppShell } from '@/components/app-shell';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading, apiOffline } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user && !apiOffline) router.replace('/login');
  }, [loading, user, apiOffline, router]);

  if (apiOffline) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="card max-w-lg space-y-3">
          <h1 className="text-lg font-semibold">API indisponível</h1>
          <p className="text-sm text-muted">{apiOffline}</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>Abra <code className="text-fg">http://localhost:3333/api/health</code> no navegador. Deve responder <code className="text-fg">status: ok</code>.</li>
            <li>Se não abrir, confira no terminal se a API carregou o <code className="text-fg">apps/api/.env</code> e conectou ao Supabase.</li>
            <li>Se ainda não configurou o ambiente, rode <code className="text-fg">npm run setup</code> e depois <code className="text-fg">npm run dev</code>.</li>
          </ol>
          <button className="btn" onClick={() => window.location.reload()}>Tentar novamente</button>
        </div>
      </main>
    );
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted">Carregando…</div>;
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="card space-y-3 text-center">
          <p>Você precisa entrar para continuar.</p>
          <Link className="btn inline-block" href="/login">Ir para o login</Link>
        </div>
      </main>
    );
  }

  return (
      <AppShell>{children}</AppShell>
  );
}
