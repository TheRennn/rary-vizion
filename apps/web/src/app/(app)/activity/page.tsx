'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/design-system';
import { api } from '@/lib/api';

type Activity = { id: string; actorId: string | null; eventType: string; module: string; title: string; entityType: string; entityId: string; projectId: string | null; href: string; createdAt: string; actor?: { name: string } | null };
type ActivityPage = { items: Activity[]; nextCursor: string | null };
type Project = { id: string; name: string };
const modules = [{ value: '', label: 'Todos os módulos' }, { value: 'projects', label: 'Projetos' }, { value: 'meetings', label: 'Reuniões' }, { value: 'calendar', label: 'Calendário' }, { value: 'settings', label: 'Administração' }];
const dateLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function ActivityPage() {
  const [module, setModule] = useState('');
  const [period, setPeriod] = useState('30');
  const [projectId, setProjectId] = useState('');
  const [query, setQuery] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [items, setItems] = useState<Activity[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { void api<Project[]>('/projects').then((value) => setProjects(value.map((project: any) => ({ id: project.id, name: project.name })))).catch(() => setProjects([])); }, []);
  const load = useCallback(async (next: string | null, append: boolean) => {
    if (append) setLoadingMore(true); else setLoading(true);
    const from = new Date(); from.setDate(from.getDate() - Number(period));
    const params = new URLSearchParams({ from: from.toISOString(), module, projectId, q: query.trim() });
    if (next) params.set('cursor', next);
    try {
      const result = await api<ActivityPage>(`/activity?${params.toString()}`);
      setItems((current) => append ? [...current, ...result.items] : result.items);
      setNextCursor(result.nextCursor);
      setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível carregar atividades.'); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [module, period, projectId, query]);

  useEffect(() => { const timer = setTimeout(() => { setItems([]); void load(null, false); }, 180); return () => clearTimeout(timer); }, [load]);
  const grouped = useMemo(() => {
    const groups = new Map<string, Activity[]>();
    for (const item of items) { const key = dateLabel.format(new Date(item.createdAt)); groups.set(key, [...(groups.get(key) ?? []), item]); }
    return [...groups.entries()];
  }, [items]);

  return <main className="page-shell space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Workspace</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Central de atividades</h1><p className="mt-1 text-sm text-muted">Acompanhe eventos de trabalho que você pode acessar.</p></div><span className="rounded-full border border-line px-3 py-1.5 text-xs text-muted">{items.length} eventos</span></header>
    <section className="filter-bar" aria-label="Filtros de atividade">
      <input className="input min-w-[190px] flex-1" aria-label="Pesquisar atividades" placeholder="Pesquisar atividades…" value={query} onChange={(event) => setQuery(event.target.value)} />
      <select className="input" aria-label="Filtrar módulo" value={module} onChange={(event) => setModule(event.target.value)}>{modules.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      <select className="input" aria-label="Filtrar período" value={period} onChange={(event) => setPeriod(event.target.value)}><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option></select>
      <select className="input min-w-[170px] max-w-full" aria-label="Filtrar projeto" value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">Todos os projetos</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
    </section>
    {error && <div role="alert" className="card border-red-400/20 p-4 text-sm text-red-200">{error}<button className="ml-3 text-primary" onClick={() => void load(null, false)}>Tentar novamente</button></div>}
    {loading ? <div className="card animate-pulse space-y-4 p-5"><div className="h-4 w-40 rounded bg-white/10"/><div className="h-16 rounded bg-white/5"/><div className="h-16 rounded bg-white/5"/></div> : items.length === 0 ? <EmptyState title="Nenhuma atividade neste período" description="Os eventos autorizados aparecerão aqui quando forem registrados." /> : <div className="space-y-5">
      {grouped.map(([date, group]) => <section key={date} className="space-y-3"><h2 className="text-xs font-medium capitalize text-muted">{date}</h2><ol className="relative ml-3 space-y-3 border-l border-line pl-5">{group.map((item) => <li key={item.id} className="relative"><span aria-hidden="true" className="absolute -left-[26px] top-3 grid h-5 w-5 place-items-center rounded-full border border-primary/30 bg-surface text-[10px] text-primary">{item.module === 'projects' ? '✓' : item.module === 'calendar' ? '◷' : item.module === 'meetings' ? '↗' : '•'}</span><Link href={item.href} className="card block p-4 transition-colors hover:border-primary/30"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{item.title}</p><time className="text-[11px] text-muted">{dateTime.format(new Date(item.createdAt))}</time></div><p className="mt-1 text-xs text-muted">{item.actor?.name ? `${item.actor.name} · ` : ''}{modules.find((option) => option.value === item.module)?.label ?? item.module}</p></Link></li>)}</ol></section>)}
    </div>}
    {!loading && nextCursor && <div className="flex justify-center"><button className="btn-secondary" disabled={loadingMore} onClick={() => void load(nextCursor, true)}>{loadingMore ? 'Carregando…' : 'Carregar mais'}</button></div>}
  </main>;
}
