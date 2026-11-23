'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';

type Meeting = { id: string; name: string; description: string | null; startsAt: string; durationMinutes: number; code: string; accessMode: string; participants: Array<{ userId: string; joinedAt: string | null }> };

export default function MeetingsPage() {
  const { can } = useAuth();
  const canCreate = can('meetings', 'create');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<Meeting | null>(null);

  const load = async () => {
    try { setMeetings(await api<Meeting[]>('/meetings')); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erro ao carregar reuniões'); }
  };
  useEffect(() => { void load(); }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api('/meetings', { method: 'POST', body: { name: String(form.get('name')), description: String(form.get('description')), startsAt: new Date(String(form.get('date')) + 'T' + String(form.get('time'))).toISOString(), durationMinutes: Number(form.get('duration')), accessMode: String(form.get('access')) } });
      event.currentTarget.reset(); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao criar reunião'); }
  }

  async function join(value?: string) {
    try {
      const meeting = await api<Meeting>('/meetings/join', { method: 'POST', body: { code: value || code } });
      setJoined(meeting); setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Reunião não encontrada'); }
  }

  if (joined) return (
    <div className="space-y-4">
      <header className="page-heading"><div><p className="eyebrow">Sala preparada</p><h1>{joined.name}</h1></div><button className="btn-ghost" onClick={() => setJoined(null)}>Sair da sala</button></header>
      <section className="card grid min-h-[420px] place-items-center p-6 text-center">
        <div><div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-primary/30 bg-primary/10 text-2xl font-semibold">R</div><p className="mt-4 text-sm font-medium">Sala sem transmissão externa</p><p className="mt-2 max-w-md text-xs leading-5 text-muted">A reunião foi persistida e registrada no espaço de trabalho. LiveKit não está configurado neste ambiente, portanto câmera, áudio e compartilhamento não são simulados.</p><p className="mt-4 rounded-md border border-line px-3 py-2 font-mono text-xs">Código {joined.code}</p></div>
      </section>
    </div>
  );

  return (
    <div className="space-y-4">
      <header className="page-heading"><div><p className="eyebrow">Agenda da equipe</p><h1>Reuniões</h1></div></header>
      {error && <p className="error-state" role="alert">{error}</p>}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="card overflow-hidden">
          <div className="border-b border-line/70 p-4"><p className="eyebrow">Próximas reuniões</p></div>
          <div className="compact-list">{meetings.map((meeting) => <li key={meeting.id}>
            <div className="flex items-center justify-between gap-3"><div><p className="font-medium">{meeting.name}</p><p className="mt-1 text-xs text-muted">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(meeting.startsAt))} · {meeting.durationMinutes} min</p></div><button className="btn-ghost" onClick={() => void join(meeting.code)}>Preparar entrada</button></div>
          </li>)}{meetings.length === 0 && <li className="text-center text-xs text-muted">Nenhuma reunião criada</li>}</div>
        </section>
        <aside className="space-y-4">
          {canCreate && <form onSubmit={create} className="card space-y-3 p-4">
            <p className="eyebrow">Criar reunião</p>
            <input name="name" className="input w-full" placeholder="Nome" required />
            <textarea name="description" className="input min-h-20 w-full resize-none" placeholder="Descrição e pauta" />
            <div className="grid grid-cols-2 gap-2"><input name="date" type="date" className="input" required /><input name="time" type="time" className="input" required /></div>
            <div className="grid grid-cols-2 gap-2"><select name="duration" className="input" defaultValue="30"><option value="30">30 min</option><option value="60">60 min</option><option value="90">90 min</option></select><select name="access" className="input"><option value="TEAM">Equipe</option><option value="PRIVATE">Privada</option></select></div>
            <button className="btn w-full">Criar e gerar link</button>
          </form>}
          <div className="card space-y-3 p-4">
            <p className="eyebrow">Ingresar por código</p>
            <input className="input w-full" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="Código da reunião" />
            <button type="button" className="btn-ghost w-full" onClick={() => void join()}>Validar código</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
