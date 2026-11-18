'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';
import { hasMinRole } from '@/lib/roles';
import type { PresenceStatus, TeamMember } from '@/lib/types';

const REFRESH_MS = 15_000;

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <p className="text-3xl font-semibold tabular-nums">{value}</p>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [team, setTeam] = useState<TeamMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSeeTeam = !!user && hasMinRole(user.role, 'MANAGER');

  const load = useCallback(async () => {
    try {
      setTeam(await api<TeamMember[]>('/time/team'));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar a equipe');
    }
  }, []);

  useEffect(() => {
    if (!canSeeTeam) return;
    void load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [canSeeTeam, load]);

  if (!user) return null;

  const count = (s: PresenceStatus) => team?.filter((m) => m.status === s).length ?? 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Olá, {user.name.split(' ')[0]}</h1>
        <p className="text-sm text-muted">{user.company.name}</p>
      </header>

      {!canSeeTeam ? (
        <p className="card text-sm text-muted">
          Registre sua jornada em <strong className="text-fg">Vizion Time</strong>. O painel da equipe é visível para gestores.
        </p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Resumo de presença">
            <Stat label="Em jornada" value={count('WORKING')} />
            <Stat label="Em pausa" value={count('ON_BREAK')} />
            <Stat label="Offline" value={count('OFFLINE')} />
            <Stat label="Total de colaboradores" value={team?.length ?? 0} />
          </section>

          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

          <section className="card p-0">
            <h2 className="border-b border-line px-4 py-3 text-sm font-medium">Presença da equipe</h2>
            {team === null ? (
              <p className="p-4 text-sm text-muted">Carregando…</p>
            ) : team.length === 0 ? (
              <p className="p-4 text-sm text-muted">Nenhum colaborador ativo. Cadastre pessoas em Workforce.</p>
            ) : (
              <ul className="divide-y divide-line">
                {team.map((m) => (
                  <li key={m.id} className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{m.name}</p>
                      <p className="truncate text-xs text-muted">
                        {[m.jobTitle, m.department?.name].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                    <StatusBadge status={m.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
