'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';
import { formatDuration, formatTime } from '@/lib/format';
import type { PresenceStatus, TimeEntryType, TodayResponse } from '@/lib/types';

const ACTIONS: Record<PresenceStatus, { type: TimeEntryType; label: string; primary?: boolean }[]> = {
  OFFLINE: [{ type: 'CLOCK_IN', label: 'Iniciar jornada', primary: true }],
  WORKING: [
    { type: 'BREAK_START', label: 'Iniciar pausa' },
    { type: 'CLOCK_OUT', label: 'Encerrar jornada' },
  ],
  ON_BREAK: [
    { type: 'BREAK_END', label: 'Voltar da pausa', primary: true },
    { type: 'CLOCK_OUT', label: 'Encerrar jornada' },
  ],
};

const ENTRY_LABEL: Record<TimeEntryType, string> = {
  CLOCK_IN: 'Entrada',
  BREAK_START: 'Saída para intervalo',
  BREAK_END: 'Retorno',
  CLOCK_OUT: 'Saída',
};

export default function TimePage() {
  const [data, setData] = useState<TodayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);
  const fetchedAt = useRef(Date.now());

  const load = useCallback(async () => {
    try {
      const res = await api<TodayResponse>('/time/today');
      fetchedAt.current = Date.now();
      setData(res);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar a jornada');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Re-render a cada segundo só para animar o cronômetro; a fonte da verdade é o servidor.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  async function record(type: TimeEntryType) {
    setBusy(true);
    try {
      await api('/time/clock', { method: 'POST', body: { type } });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao registrar');
    } finally {
      setBusy(false);
    }
  }

  const elapsed = data?.status === 'WORKING' ? Math.floor((Date.now() - fetchedAt.current) / 1000) : 0;
  const worked = (data?.workedSeconds ?? 0) + elapsed;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Minha jornada</h1>
        <p className="text-sm text-muted">Os horários são registrados pelo servidor.</p>
      </header>

      <section className="card space-y-4">
        <div className="flex items-end justify-between">
          <p className="font-mono text-5xl tabular-nums" aria-live="off">{formatDuration(worked)}</p>
          {data && <StatusBadge status={data.status} />}
        </div>

        <div className="flex flex-wrap gap-3">
          {data &&
            ACTIONS[data.status].map((a) => (
              <button
                key={a.type}
                className={a.primary ? 'btn' : 'btn-ghost'}
                disabled={busy}
                onClick={() => record(a.type)}
              >
                {a.label}
              </button>
            ))}
        </div>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      </section>

      <section className="card p-0">
        <h2 className="border-b border-line px-4 py-3 text-sm font-medium">Registros de hoje</h2>
        {!data ? (
          <p className="p-4 text-sm text-muted">Carregando…</p>
        ) : data.entries.length === 0 ? (
          <p className="p-4 text-sm text-muted">Nenhum registro hoje. Inicie sua jornada para começar.</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>{ENTRY_LABEL[e.type]}</span>
                <span className="font-mono text-muted">{formatTime(e.recordedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
