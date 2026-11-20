'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { TimeEntry } from '@/lib/types';

export default function ReportsPage() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<TimeEntry[]>('/time/history').then(setEntries).catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar relatório'));
  }, []);

  function exportCsv() {
    const rows = [['Data', 'Tipo', 'Observação'], ...entries.map((entry) => [new Date(entry.recordedAt).toISOString(), entry.type, entry.note ?? ''])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'relatorio-jornada.csv'; link.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <header className="page-heading"><div><p className="eyebrow">Dados auditáveis</p><h1>Reports</h1></div><button className="btn" onClick={exportCsv} disabled={entries.length === 0}>Exportar jornada CSV</button></header>
      {error && <p className="error-state" role="alert">{error}</p>}
      <section className="card overflow-hidden">
        <div className="border-b border-line/70 p-4"><p className="eyebrow">Relatório de jornada</p><h2 className="mt-1 text-sm font-semibold">{entries.length} registros encontrados</h2></div>
        <div className="data-table-scroll"><table className="data-table"><thead><tr><th>Data e hora</th><th>Evento</th><th>Observação</th></tr></thead><tbody>{entries.slice(0, 100).map((entry) => <tr key={entry.id}><td>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.recordedAt))}</td><td>{entry.type}</td><td>{entry.note ?? '—'}</td></tr>)}</tbody></table></div>
      </section>
    </div>
  );
}
