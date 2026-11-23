'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState, ErrorState, Skeleton } from '@/components/design-system';
import { useAuth } from '@/components/auth-provider';
import { api } from '@/lib/api';
import { formatDuration, formatTime } from '@/lib/format';
import type { ChatConversation, TimeEntry, TodayResponse } from '@/lib/types';

type Task = { id: string; title: string; status: string; priority: string; dueAt: string | null; assigneeId: string | null };
type Project = { id: string; name: string; status: string; ownerId: string | null; tasks: Task[] };
type Meeting = { id: string; name: string; startsAt: string; durationMinutes: number; participants: Array<{ userId: string }> };
type Notice = { id: string; title: string; body: string; href: string | null; readAt: string | null; createdAt: string };
type Widget = 'time' | 'tasks' | 'projects' | 'meetings' | 'inbox' | 'chat' | 'focus' | 'week';
type FocusSession = { id: string; taskId: string; task?: { title: string }; startedAt: string; pausedAt: string | null; finishedAt: string | null; pausedSeconds: number; status: 'RUNNING' | 'PAUSED' | 'COMPLETED' };
type FocusOverview = { active: FocusSession | null; history: FocusSession[] };
type ScheduleItem = { id: string; source: 'meeting' | 'task' | 'event'; title: string; start: string; end: string; href: string };
const WIDGETS: Widget[] = ['time', 'tasks', 'projects', 'meetings', 'inbox', 'chat', 'focus', 'week'];
const LABELS: Record<Widget, string> = { time: 'Minha jornada', tasks: 'Minhas tarefas', projects: 'Meus projetos', meetings: 'Próximas reuniões', inbox: 'Notificações', chat: 'Conversas recentes', focus: 'Modo foco', week: 'Minha semana' };

function readPrefs(): { order: Widget[]; hidden: Widget[] } {
  try {
    const value = JSON.parse(localStorage.getItem('vizion.workspace.widgets') ?? '{}') as { order?: Widget[]; hidden?: Widget[] };
    return { order: [...(value.order ?? []), ...WIDGETS.filter((widget) => !value.order?.includes(widget))], hidden: (value.hidden ?? []).filter((widget) => WIDGETS.includes(widget)) };
  } catch { return { order: WIDGETS, hidden: [] }; }
}

export default function WorkspacePage() {
  const { user, can } = useAuth();
  const [prefs, setPrefs] = useState<{ order: Widget[]; hidden: Widget[] }>({ order: WIDGETS, hidden: [] });
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [history, setHistory] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [focusData, setFocusData] = useState<FocusOverview>({ active: null, history: [] });
  const [weekItems, setWeekItems] = useState<ScheduleItem[]>([]);
  const [clock, setClock] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => setPrefs(readPrefs()), []);
  useEffect(() => { void api<{ order: Widget[]; hidden: Widget[] }>('/workspace/preferences').then((value) => setPrefs({ order: [...value.order, ...WIDGETS.filter((item) => !value.order.includes(item))], hidden: value.hidden.filter((item) => WIDGETS.includes(item)) })).catch(() => undefined); }, []);
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!user) return;
    let active = true;
    const sources = [
      ...(can('time', 'view') ? [api<TodayResponse>('/time/today').then((value) => { if (active) setToday(value); }), api<TimeEntry[]>('/time/history').then((value) => { if (active) setHistory(value); })] : []),
      ...(can('projects', 'view') ? [api<Project[]>('/projects').then((value) => { if (active) setProjects(value); })] : []),
      ...(can('projects', 'view') ? [api<FocusOverview>('/workspace/focus').then((value) => { if (active) setFocusData(value); })] : []),
      ...(can('workspace', 'view') ? [(() => { const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); const end = new Date(start); end.setDate(end.getDate() + 7); return api<ScheduleItem[]>(`/calendar?from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`).then((value) => { if (active) setWeekItems(value); }); })()] : []),
      ...(can('meetings', 'view') ? [api<Meeting[]>('/meetings').then((value) => { if (active) setMeetings(value); })] : []),
      ...(can('inbox', 'view') ? [api<Notice[]>('/notifications').then((value) => { if (active) setNotices(value); })] : []),
      ...(can('chat', 'view') ? [api<ChatConversation[]>('/chat/conversations').then((value) => { if (active) setConversations(value); })] : []),
    ];
    void Promise.allSettled(sources).then((results) => {
      if (!active) return;
      setErrors(results.flatMap((result) => result.status === 'rejected' ? [result.reason instanceof Error ? result.reason.message : 'Falha ao carregar um bloco'] : []));
      setLoading(false);
    });
    return () => { active = false; };
  }, [user, can, reloadKey]);

  const myProjects = useMemo(() => projects.filter((project) => project.ownerId === user?.id || project.tasks.some((task) => task.assigneeId === user?.id)), [projects, user?.id]);
  const myTasks = useMemo(() => projects.flatMap((project) => project.tasks.filter((task) => task.assigneeId === user?.id && task.status !== 'DONE').map((task) => ({ ...task, project: project.name }))), [projects, user?.id]);
  const myMeetings = useMemo(() => meetings.filter((meeting) => meeting.participants.some((participant) => participant.userId === user?.id) && new Date(meeting.startsAt) >= new Date()).slice(0, 5), [meetings, user?.id]);
  const unread = notices.filter((notice) => !notice.readAt);

  function savePrefs(next: { order: Widget[]; hidden: Widget[] }) { setPrefs(next); localStorage.setItem('vizion.workspace.widgets', JSON.stringify(next)); void api('/workspace/preferences', { method: 'PATCH', body: next }).catch(() => undefined); }
  function move(widget: Widget, direction: -1 | 1) {
    const index = prefs.order.indexOf(widget); const destination = index + direction;
    if (destination < 0 || destination >= prefs.order.length) return;
    const order = [...prefs.order]; [order[index], order[destination]] = [order[destination], order[index]]; savePrefs({ ...prefs, order });
  }
  function toggle(widget: Widget) { savePrefs({ ...prefs, hidden: prefs.hidden.includes(widget) ? prefs.hidden.filter((item) => item !== widget) : [...prefs.hidden, widget] }); }

  if (!user) return null;
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const visible = prefs.order.filter((widget) => !prefs.hidden.includes(widget));
  const canManageWidgets = true;
  const widget = (name: Widget) => {
    const controls = canManageWidgets && <div className="flex items-center gap-1"><button className="icon-button !h-7 !w-7" aria-label={`Mover ${LABELS[name]} para cima`} title="Mover para cima" onClick={() => move(name, -1)}>↑</button><button className="icon-button !h-7 !w-7" aria-label={`Mover ${LABELS[name]} para baixo`} title="Mover para baixo" onClick={() => move(name, 1)}>↓</button><button className="icon-button !h-7 !w-7" aria-label={`Ocultar ${LABELS[name]}`} title="Ocultar widget" onClick={() => toggle(name)}>×</button></div>;
    const head = <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">{LABELS[name]}</h2>{controls}</div>;
    if (loading) return <section key={name} className="card p-4" aria-busy="true">{head}<Skeleton className="h-20" /></section>;
    if (name === 'time') return <section key={name} className="card p-4">{head}{!can('time', 'view') ? <EmptyState title="Jornada indisponível" description="Seu perfil não tem acesso aos registros de jornada." /> : <><Link href="/time" className="flex items-end justify-between gap-3"><div><p className="font-mono text-3xl font-medium tabular-nums">{today ? formatDuration(today.workedSeconds) : '—'}</p><p className="mt-1 text-xs text-muted">{today?.status === 'WORKING' ? 'Jornada em andamento' : today?.status === 'ON_BREAK' ? 'Em intervalo' : 'Fora da jornada'}</p></div><span className="btn-ghost">Abrir jornada</span></Link><div className="mt-4 flex flex-wrap gap-3">{history.slice(0, 3).map((entry) => <span key={entry.id} className="text-[11px] text-muted">{entry.type.replace('_', ' ')} · {formatTime(entry.recordedAt)}</span>)}</div></>}</section>;
    if (name === 'tasks') return <section key={name} className="card p-4">{head}{!can('projects', 'view') ? <EmptyState title="Projetos indisponíveis" description="Seu perfil não tem acesso às tarefas dos projetos." /> : myTasks.length ? <ul className="divide-y divide-line/60">{myTasks.slice(0, 8).map((task) => <li key={task.id} className="flex items-center justify-between gap-3 py-2"><div className="min-w-0"><p className="truncate text-xs font-medium">{task.title}</p><p className="mt-1 truncate text-[10px] text-muted">{task.project}</p></div><span className="shrink-0 text-[10px] text-muted">{task.dueAt ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(task.dueAt)) : 'Sem prazo'}</span></li>)}</ul> : <EmptyState title="Sem tarefas atribuídas" description="Tarefas atribuídas a você aparecerão aqui." action={<Link href="/projects" className="text-xs text-primary">Ver projetos</Link>} />}</section>;
    if (name === 'projects') return <section key={name} className="card p-4">{head}{!can('projects', 'view') ? <EmptyState title="Projetos indisponíveis" description="Seu perfil não tem acesso a projetos." /> : myProjects.length ? <ul className="divide-y divide-line/60">{myProjects.slice(0, 6).map((project) => <li key={project.id} className="flex items-center justify-between gap-2 py-2"><Link className="truncate text-xs hover:text-primary" href="/projects">{project.name}</Link><span className="status-indicator">{project.status === 'ACTIVE' ? 'Ativo' : project.status}</span></li>)}</ul> : <EmptyState title="Nenhum projeto seu ainda" description="Projetos que você coordena ou em que tem tarefa atribuída ficam nesta lista." action={<Link href="/projects" className="text-xs text-primary">Explorar projetos</Link>} />}</section>;
    if (name === 'meetings') return <section key={name} className="card p-4">{head}{!can('meetings', 'view') ? <EmptyState title="Agenda indisponível" description="Seu perfil não tem acesso a reuniões." /> : myMeetings.length ? <ul className="divide-y divide-line/60">{myMeetings.map((meeting) => <li key={meeting.id} className="py-2"><p className="text-xs font-medium">{meeting.name}</p><p className="mt-1 text-[10px] text-muted">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(meeting.startsAt))}</p></li>)}</ul> : <EmptyState title="Agenda sem reuniões" description="Convites para reuniões futuras serão mostrados aqui." action={<Link href="/meetings" className="text-xs text-primary">Abrir agenda</Link>} />}</section>;
    if (name === 'inbox') return <section key={name} className="card p-4">{head}{!can('inbox', 'view') ? <EmptyState title="Caixa indisponível" description="Seu perfil não tem acesso às notificações." /> : unread.length ? <ul className="divide-y divide-line/60">{unread.slice(0, 5).map((notice) => <li key={notice.id} className="py-2"><Link href={notice.href ?? '/inbox'} className="text-xs font-medium hover:text-primary">{notice.title}</Link><p className="mt-1 line-clamp-2 text-[10px] text-muted">{notice.body}</p></li>)}</ul> : <EmptyState title="Tudo em dia" description="Você não tem notificações pendentes." action={<Link href="/inbox" className="text-xs text-primary">Abrir caixa de entrada</Link>} />}</section>;
    if (name === 'focus') { const active = focusData.active; const elapsed = active ? Math.max(0, Math.floor(((active.pausedAt ? new Date(active.pausedAt).getTime() : clock) - new Date(active.startedAt).getTime()) / 1000) - active.pausedSeconds) : 0; return <section key={name} className="card p-4">{head}{!can('projects', 'view') ? <EmptyState title="Foco indisponível" description="Seu perfil não pode acessar tarefas de projetos." /> : <><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-medium">{active?.task?.title ?? 'Escolha uma tarefa para começar'}</p><p className="mt-2 font-mono text-3xl tabular-nums">{formatDuration(elapsed)}</p><p className="mt-1 text-[10px] text-muted">{active?.status === 'PAUSED' ? 'Pausado' : active ? 'Sessão em andamento · não altera a jornada' : 'Sessões de foco são separadas do ponto eletrônico'}</p></div><div className="flex shrink-0 gap-2">{active ? <><button className="btn-ghost" onClick={async () => { await api(`/workspace/focus/${active.status === 'PAUSED' ? 'resume' : 'pause'}`, { method: 'POST' }); setReloadKey((key) => key + 1); }}>{active.status === 'PAUSED' ? 'Retomar' : 'Pausar'}</button><button className="btn" onClick={async () => { await api('/workspace/focus/finish', { method: 'POST' }); setReloadKey((key) => key + 1); }}>Finalizar</button></> : <form className="flex gap-2" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); await api('/workspace/focus', { method: 'POST', body: { taskId: String(form.get('taskId')) } }); setReloadKey((key) => key + 1); }}><select name="taskId" className="input max-w-40" required defaultValue=""><option value="" disabled>Tarefa…</option>{myTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select><button className="btn" disabled={!myTasks.length}>Iniciar</button></form>}</div></div><div className="mt-4 border-t border-line/60 pt-3"><p className="text-[10px] font-medium text-muted">Histórico recente</p><ul className="mt-2 space-y-1">{focusData.history.filter((session) => session.status === 'COMPLETED').slice(0, 4).map((session) => <li key={session.id} className="flex justify-between gap-3 text-[10px]"><span className="truncate">{session.task?.title ?? 'Tarefa'}</span><span className="text-muted">{formatDuration(Math.max(0, Math.floor((new Date(session.finishedAt!).getTime() - new Date(session.startedAt).getTime()) / 1000) - session.pausedSeconds))}</span></li>)}</ul></div></>}</section>; }
    if (name === 'week') return <section key={name} className="card p-4">{head}{weekItems.length ? <ul className="divide-y divide-line/60">{weekItems.slice(0, 12).map((item) => <li key={`${item.source}-${item.id}`} className="flex items-center gap-3 py-2"><time className="w-28 shrink-0 text-[10px] text-muted">{new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(item.start))}</time><Link href={item.href} className="truncate text-xs hover:text-primary">{item.title}</Link></li>)}</ul> : <EmptyState title="Semana sem itens" description="Prazos, reuniões e eventos desta semana aparecerão aqui." action={<Link href="/calendar" className="text-xs text-primary">Abrir calendário</Link>} />}</section>;
    return <section key={name} className="card p-4">{head}{!can('chat', 'view') ? <EmptyState title="Chat indisponível" description="Seu perfil não tem acesso às conversas." /> : conversations.length ? <ul className="divide-y divide-line/60">{conversations.slice(0, 5).map((conversation) => <li key={conversation.id} className="flex items-center justify-between gap-2 py-2"><div className="min-w-0"><p className="truncate text-xs font-medium">{conversation.name ?? conversation.peer?.name ?? 'Conversa direta'}</p><p className="mt-1 truncate text-[10px] text-muted">{conversation.lastMessage?.body ?? 'Sem mensagens'}</p></div><span className="text-[10px] text-muted">{conversation.unread ? 'Não lida' : ''}</span></li>)}</ul> : <EmptyState title="Sem conversas recentes" description="Mensagens da sua equipe aparecerão aqui." action={<Link href="/chat" className="text-xs text-primary">Abrir chat</Link>} />}</section>;
  };

  return <div className="space-y-5">
    <header className="page-heading"><div><p className="eyebrow">Meu espaço</p><h1>{hello}, {user.name.split(' ')[0]}</h1><p className="mt-1 text-xs text-muted">Seu resumo de trabalho em {user.company.name}</p></div><div className="flex items-center gap-2"><Link href="/time" className="btn">Registrar jornada</Link><Link href="/projects" className="btn-ghost">Meus projetos</Link></div></header>
    <section className="grid gap-3 sm:grid-cols-3"><div className="card p-4"><p className="text-xs text-muted">Jornada de hoje</p><p className="mt-2 text-xl font-semibold">{can('time', 'view') && today ? formatDuration(today.workedSeconds) : '—'}</p></div><div className="card p-4"><p className="text-xs text-muted">Tarefas pendentes</p><p className="mt-2 text-xl font-semibold">{can('projects', 'view') ? myTasks.length : '—'}</p></div><div className="card p-4"><p className="text-xs text-muted">Não lidas</p><p className="mt-2 text-xl font-semibold">{can('inbox', 'view') ? unread.length : '—'}</p></div></section>
    {errors.length > 0 && <ErrorState message="Alguns blocos não puderam carregar. Os dados disponíveis continuam abaixo." onRetry={() => { setLoading(true); setReloadKey((key) => key + 1); }} />}
    {canManageWidgets && <details className="card px-4 py-3"><summary className="cursor-pointer text-xs font-medium">Personalizar meu espaço</summary><p className="mt-2 text-[11px] text-muted">Reordene os blocos com as setas ou oculte os que não usa. As preferências são salvas na sua conta e sincronizadas entre dispositivos.</p><div className="mt-3 flex flex-wrap gap-2">{WIDGETS.filter((item) => prefs.hidden.includes(item)).map((item) => <button key={item} className="btn-ghost" onClick={() => toggle(item)}>Mostrar {LABELS[item]}</button>)}<button className="btn-ghost" onClick={() => savePrefs({ order: WIDGETS, hidden: [] })}>Restaurar layout</button></div></details>}
    <div className="grid gap-4 xl:grid-cols-2">{visible.map(widget)}</div>
  </div>;
}
