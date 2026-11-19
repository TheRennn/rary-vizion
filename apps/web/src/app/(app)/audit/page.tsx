'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { api } from '@/lib/api';
import { hasMinRole } from '@/lib/roles';
import type { AuditLog } from '@/lib/types';
import { DataTable, EmptyState, PageHeading } from '@/components/design-system';

const ACTION_LABEL: Record<string, string> = {
  'time.recorded': 'Registrou ponto',
  'user.created': 'Criou colaborador',
  'user.updated': 'Atualizou colaborador',
  'user.archived': 'Arquivou colaborador',
  'user.reactivated': 'Reativou colaborador',
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
      <PageHeading eyebrow="Governança" title="Auditoria" description="Atividades registradas no workspace." />

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
          <EmptyState title="Nenhuma atividade registrada" description="As ações do workspace aparecerão aqui quando forem registradas." />
        ) : (
          <DataTable
            rows={logs}
            rowLabel={(log) => `${ACTION_LABEL[log.action] ?? log.action} ${log.entity}`}
            columns={[
              { key: 'action', label: 'Ação', render: (log) => <span className="font-medium">{ACTION_LABEL[log.action] ?? log.action}</span> },
              { key: 'entity', label: 'Registro', render: (log) => <span className="text-muted">{log.entity}{log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ''}</span> },
              { key: 'actor', label: 'Ator', render: (log) => <span className="text-muted">{log.actorId ? log.actorId.slice(0, 8) : 'Sistema'}</span> },
              { key: 'date', label: 'Data', render: (log) => <time className="whitespace-nowrap text-muted" dateTime={log.createdAt}>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(log.createdAt))}</time> },
            ]}
          />
        )}
      </section>
    </div>
  );
}
