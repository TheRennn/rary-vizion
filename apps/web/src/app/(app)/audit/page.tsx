'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { api } from '@/lib/api';
import { hasMinRole } from '@/lib/roles';
import type { AuditLog } from '@/lib/types';

const ACTION_LABEL: Record<string, string> = {
  'time.recorded': 'Registrou ponto',
  'user.created': 'Criou colaborador',
  'department.created': 'Criou departamento',
  'user.login': 'Acessou o workspace',
};

export default function AuditPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !hasMinRole(user.role, 'ADMIN')) return;
    api<AuditLog[]>('/audit')
      .then(setLogs)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar auditoria'));
  }, [user]);

  if (!user) return null;
  if (!hasMinRole(user.role, 'ADMIN')) {
    return (
      <section className="card max-w-xl p-6">
        <p className="eyebrow">Acesso restrito</p>
        <h1 className="mt-2 text-xl font-semibold">Auditoria</h1>
        <p className="mt-2 text-sm text-muted">Esta área é disponível apenas para administradores.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow mb-2">Governança</p>
        <h1 className="text-3xl font-semibold tracking-tight">Auditoria</h1>
        <p className="mt-1 text-sm text-muted">Atividades registradas no workspace.</p>
      </header>

      {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-300">{error}</p>}

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line/80 px-5 py-4">
          <div>
            <p className="eyebrow">Eventos recentes</p>
            <h2 className="mt-1 text-sm font-semibold">Registro de atividades</h2>
          </div>
          {logs && <span className="text-xs text-muted">{logs.length} eventos</span>}
        </div>
        {logs === null ? (
          <p className="p-5 text-sm text-muted">Carregando auditoria…</p>
        ) : logs.length === 0 ? (
          <p className="p-5 text-sm text-muted">Nenhuma atividade registrada.</p>
        ) : (
          <div className="divide-y divide-line/70">
            {logs.map((log) => (
              <div key={log.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[10rem_1fr_auto] sm:items-center">
                <span className="text-sm font-medium">{ACTION_LABEL[log.action] ?? log.action}</span>
                <span className="text-xs text-muted">{log.entity}{log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ''}</span>
                <time className="text-xs text-muted" dateTime={log.createdAt}>
                  {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(log.createdAt))}
                </time>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
