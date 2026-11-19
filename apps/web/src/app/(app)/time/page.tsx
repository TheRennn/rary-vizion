'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBadge } from '@/components/status-badge';
import { api } from '@/lib/api';
import { formatDuration, formatTime } from '@/lib/format';
import type { PresenceStatus, TimeEntry, TimeEntryType, TodayResponse } from '@/lib/types';

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
  const [history, setHistory] = useState<TimeEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);
  const fetchedAt = useRef(Date.now());

  const load = useCallback(async () => {
    try {
      const [res, entries] = await Promise.all([
        api<TodayResponse>('/time/today'),
        api<TimeEntry[]>('/time/history'),
      ]);
      fetchedAt.current = Date.now();
      setData(res);
      setHistory(entries);
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
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <p className="eyebrow mb-2">Controle de jornada</p>
          <h1 className="text-3xl font-semibold tracking-tight">Minha jornada</h1>
        </div>
        <p className="hidden text-xs text-muted sm:block">Horário validado pelo servidor</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
        <section className="card relative overflow-hidden p-6 sm:p-8">
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-8">
            <div className="flex items-start justify-between">
              <div>
                <p className="eyebrow">Tempo trabalhado hoje</p>
                <p className="mt-4 font-mono text-5xl font-medium tracking-tight tabular-nums sm:text-6xl" aria-live="off">
                  {formatDuration(worked)}
                </p>
              </div>
              {data && <StatusBadge status={data.status} />}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {data &&
                ACTIONS[data.status].map((a) => (
                  <button
                    key={a.type}
                    className={`${a.primary ? 'btn h-14' : 'btn-ghost h-14'} ${a.type === 'CLOCK_OUT' ? 'border-red-400/20 text-red-300 hover:border-red-400/40' : ''}`}
                    disabled={busy}
                    onClick={() => record(a.type)}
                  >
                    {busy ? 'Registrando…' : a.label}
                  </button>
                ))}
            </div>
            {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/5 px-3 py-2 text-sm text-red-300">{error}</p>}
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-line/80 px-5 py-4">
            <p className="eyebrow">Hoje</p>
            <h2 className="mt-1 text-sm font-semibold">Linha do tempo</h2>
          </div>
          {!data ? (
            <p className="p-5 text-sm text-muted">Carregando…</p>
          ) : data.entries.length === 0 ? (
            <div className="p-6 text-center">
              <div className="mx-auto mb-3 h-10 w-10 rounded-full border border-dashed border-line" />
              <p className="text-sm text-muted">Nenhum registro hoje.</p>
            </div>
          ) : (
            <ol className="p-3">
              {data.entries.map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <span className="flex-1 text-sm">{ENTRY_LABEL[e.type]}</span>
                  <span className="font-mono text-xs text-muted">{formatTime(e.recordedAt)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-line/80 px-5 py-4">
          <p className="eyebrow">Histórico</p>
          <h2 className="mt-1 text-sm font-semibold">Últimos registros</h2>
        </div>
        {history.length === 0 ? (
          <p className="p-5 text-sm text-muted">Nenhum registro encontrado nos últimos 30 dias.</p>
        ) : (
          <div className="divide-y divide-line/70">
            {history.slice(0, 12).map((e) => (
              <div key={e.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span>{ENTRY_LABEL[e.type]}</span>
                <time className="text-xs text-muted" dateTime={e.recordedAt}>
                  {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(e.recordedAt))}
                </time>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
