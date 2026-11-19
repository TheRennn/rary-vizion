'use client';

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
            <li>Se não abrir, olhe o terminal do <code className="text-fg">npm run dev</code>: o erro da API aparece lá (.env, banco ou Prisma).</li>
            <li>Primeira vez? Rode <code className="text-fg">npm run setup</code> e depois <code className="text-fg">npm run dev</code>.</li>
          </ol>
          <button className="btn" onClick={() => window.location.reload()}>Tentar novamente</button>
        </div>
      </main>
    );
  }

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-muted">Carregando…</div>;
  }

  return (
      <AppShell>{children}</AppShell>
  );
}
