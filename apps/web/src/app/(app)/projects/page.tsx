'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';

type Task = { id: string; title: string; description: string | null; status: string; priority: string; assigneeId: string | null; startsAt?: string | null; dueAt?: string | null; completedAt?: string | null; isMilestone?: boolean; parentTaskId?: string | null; labels?: string[] };
type Comment = { id: string; taskId: string; authorId: string; author?: { id: string; name: string }; body: string; createdAt: string };
type Member = { id: string; name: string };
type Project = { id: string; name: string; description: string | null; status: string; dueAt: string | null; tasks: Task[] };

const columns = [
  { id: 'TODO', label: 'A fazer' },
  { id: 'IN_PROGRESS', label: 'Em andamento' },
  { id: 'REVIEW', label: 'Em revisão' },
  { id: 'DONE', label: 'Concluído' },
];
const PROJECT_STATUS: Record<string, string> = { PLANNING: 'Em planejamento', ACTIVE: 'Ativo', ON_HOLD: 'Pausado', COMPLETED: 'Concluído', ARCHIVED: 'Arquivado' };
const PRIORITY: Record<string, string> = { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta', URGENT: 'Urgente' };

export default function ProjectsPage() {
  const { can } = useAuth();
  const canCreate = can('projects', 'create');
  const canEdit = can('projects', 'edit');
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [view, setView] = useState<'board' | 'list' | 'timeline'>('board');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState('ALL');
  const [draggingTaskId, setDraggingTaskId] = useState('');
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const data = await api<Project[]>('/projects');
      setProjects(data);
      const params = new URLSearchParams(window.location.search);
      const requestedProject = params.get('projectId');
      const requestedTask = params.get('taskId');
      const targetProject = data.find((item) => item.id === requestedProject);
      setSelectedId((current) => targetProject?.id || current || data[0]?.id || '');
      if (requestedTask && targetProject) {
        const targetTask = targetProject.tasks.find((item) => item.id === requestedTask);
        if (targetTask) setActiveTask(targetTask);
      }
      setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao carregar projetos'); }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (can('workforce', 'view')) void api<Member[]>('/users').then(setMembers).catch(() => setMembers([])); }, [can]);
  const selected = projects.find((project) => project.id === selectedId) ?? null;
  const projectTasks = useMemo(() => selected?.tasks ?? [], [selected]);
  const filteredTasks = useMemo(() => projectTasks.filter((task) => `${task.title} ${task.description ?? ''} ${(task.labels ?? []).join(' ')}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()) && (statusFilter === 'ALL' || task.status === statusFilter) && (priorityFilter === 'ALL' || task.priority === priorityFilter) && (assigneeFilter === 'ALL' || task.assigneeId === assigneeFilter)), [projectTasks, query, statusFilter, priorityFilter, assigneeFilter]);

  useEffect(() => {
    if (!selected || !activeTask) { setComments([]); return; }
    void api<Comment[]>(`/projects/${selected.id}/tasks/${activeTask.id}/comments`).then(setComments).catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar comentários'));
  }, [selected?.id, activeTask?.id]);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const project = await api<Project>('/projects', { method: 'POST', body: { name: String(form.get('name')).trim(), description: String(form.get('description')).trim(), dueAt: String(form.get('dueAt') || '') || undefined } });
      event.currentTarget.reset();
      await load();
      setSelectedId(project.id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao criar projeto'); } finally { setBusy(false); }
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await api(`/projects/${selected.id}/tasks`, { method: 'POST', body: { title: String(form.get('title')).trim(), status: String(form.get('status')), priority: String(form.get('priority')), startsAt: String(form.get('startsAt') || '') || undefined, dueAt: String(form.get('dueAt') || '') || undefined, isMilestone: form.get('isMilestone') === 'on', labels: String(form.get('labels') || '').split(',').map((label) => label.trim()).filter(Boolean) } });
      event.currentTarget.reset();
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao criar tarefa'); } finally { setBusy(false); }
  }

  async function changeStatus(projectId: string, taskId: string, status: string) {
    try {
      setProjects((items) => items.map((project) => project.id === projectId ? { ...project, tasks: project.tasks.map((task) => task.id === taskId ? { ...task, status } : task) } : project));
      await api(`/projects/${projectId}/tasks/${taskId}`, { method: 'PATCH', body: { status } });
      await load();
    } catch (e) { await load(); setError(e instanceof Error ? e.message : 'Erro ao atualizar tarefa'); }
  }

  return (
    <div className="space-y-4">
      <header className="page-heading">
        <div><p className="eyebrow">Gestão operacional</p><h1>Projetos</h1></div>
        <div className="flex gap-2">
          <button className={view === 'board' ? 'btn' : 'btn-ghost'} onClick={() => setView('board')}>Kanban</button>
          <button className={view === 'list' ? 'btn' : 'btn-ghost'} onClick={() => setView('list')}>Lista</button>
          <button className={view === 'timeline' ? 'btn' : 'btn-ghost'} onClick={() => setView('timeline')}>Timeline</button>
        </div>
      </header>
      {error && <p className="error-state" role="alert">{error}</p>}
      <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="card p-3">
          {canCreate && <form onSubmit={createProject} className="space-y-2 border-b border-line/70 pb-3">
            <input name="name" className="input w-full" placeholder="Novo projeto" required />
            <input name="description" className="input w-full" placeholder="Descrição" />
            <input name="dueAt" type="date" className="input w-full" />
            <button className="btn w-full" disabled={busy}>Criar projeto</button>
          </form>}
          <nav className="compact-list mt-2">
            {projects.map((project) => (
              <li key={project.id}>
                <button className={`w-full text-left ${selectedId === project.id ? 'text-primary' : ''}`} onClick={() => setSelectedId(project.id)}>
                  <span className="block truncate text-sm font-medium">{project.name}</span>
                  <span className="mt-1 block text-[10px] text-muted">{project.tasks.length} tarefas · {PROJECT_STATUS[project.status] ?? project.status}</span>
                </button>
              </li>
            ))}
            {projects.length === 0 && <li className="text-center text-xs text-muted">Nenhum projeto criado</li>}
          </nav>
        </aside>
        <main className="min-w-0">
          {!selected ? <section className="empty-state card"><span className="empty-state-mark">□</span><h2>Selecione ou crie um projeto</h2></section> : (
            <div className="space-y-3">
              <section className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="eyebrow">Projeto ativo</p><h2 className="mt-1 text-lg font-semibold">{selected.name}</h2>{selected.description && <p className="mt-1 text-xs text-muted">{selected.description}</p>}</div>
                  <select className="input" disabled={!canEdit} value={selected.status} onChange={async (event) => { await api(`/projects/${selected.id}`, { method: 'PATCH', body: { status: event.target.value } }); await load(); }}>
                    {Object.entries(PROJECT_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
              </section>
              <div className="filter-bar"><input className="input min-w-[180px] flex-1" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar tarefas…" aria-label="Buscar tarefas" /><select className="input" aria-label="Filtrar por status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">Todos os status</option>{columns.map((column) => <option key={column.id} value={column.id}>{column.label}</option>)}</select><select className="input" aria-label="Filtrar por prioridade" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="ALL">Todas prioridades</option>{Object.entries(PRIORITY).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select className="input min-w-36" aria-label="Filtrar por responsável" value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)}><option value="ALL">Todos responsáveis</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select><span className="text-xs text-muted">{filteredTasks.length} de {projectTasks.length} tarefas</span></div>
              {canCreate && <form onSubmit={createTask} className="filter-bar">
                <input name="title" className="input min-w-[180px] flex-1" placeholder="Nova tarefa" required />
                <input name="startsAt" type="date" className="input" aria-label="Data de início" />
                <input name="dueAt" type="date" className="input" aria-label="Prazo" />
                <label className="flex items-center gap-1.5 text-[10px] text-muted"><input name="isMilestone" type="checkbox" />Marco</label>
                <input name="labels" className="input w-36" placeholder="Etiquetas (vírgula)" aria-label="Etiquetas separadas por vírgula" />
                <select name="status" className="input" defaultValue="TODO">{columns.map((column) => <option key={column.id} value={column.id}>{column.label}</option>)}</select>
                <select name="priority" className="input" defaultValue="MEDIUM">{Object.entries(PRIORITY).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                <button className="btn" disabled={busy}>Adicionar</button>
              </form>}
              {view === 'board' ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {columns.map((column) => (
                    <section key={column.id} className="card min-h-64 p-3">
                      <div className="mb-3 flex justify-between text-xs"><span className="font-medium">{column.label}</span><span className="text-muted">{filteredTasks.filter((task) => task.status === column.id).length}</span></div>
                      <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (draggingTaskId) void changeStatus(selected.id, draggingTaskId, column.id); setDraggingTaskId(''); }} className="min-h-48 space-y-2">{filteredTasks.filter((task) => task.status === column.id).map((task) => <article key={task.id} draggable={canEdit} onDragStart={() => setDraggingTaskId(task.id)} onDragEnd={() => setDraggingTaskId('')} className={`rounded-lg border border-line/70 bg-surface2/30 p-3 ${draggingTaskId === task.id ? 'opacity-50' : ''}`}>
                        <button className="text-left text-sm font-medium hover:text-primary" onClick={() => setActiveTask(task)}>{task.title}</button><p className="mt-2 text-[10px] text-muted">{PRIORITY[task.priority] ?? task.priority}{task.dueAt ? ` · prazo ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(task.dueAt))}` : ''}{task.assigneeId ? ` · ${members.find((member) => member.id === task.assigneeId)?.name ?? 'Responsável'}` : ''}</p><div className="mt-2 flex flex-wrap gap-1">{(task.labels ?? []).map((label) => <span key={label} className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary">{label}</span>)}{projectTasks.some((child) => child.parentTaskId === task.id) && <span className="text-[9px] text-muted">{projectTasks.filter((child) => child.parentTaskId === task.id && child.status === 'DONE').length}/{projectTasks.filter((child) => child.parentTaskId === task.id).length} subtarefas</span>}</div>
                        <select className="input mt-3 w-full" disabled={!canEdit} value={task.status} onChange={(event) => void changeStatus(selected.id, task.id, event.target.value)}>{columns.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
                      </article>)}</div>
                    </section>
                  ))}
                </div>
              ) : (
                view === 'list' ? <section className="card overflow-hidden"><table className="data-table"><thead><tr><th>Tarefa</th><th>Status</th><th>Prioridade</th><th>Prazo</th></tr></thead><tbody>{filteredTasks.map((task) => <tr key={task.id}><td><button className="text-left hover:text-primary" onClick={() => setActiveTask(task)}>{task.title}</button></td><td><select className="input" disabled={!canEdit} value={task.status} onChange={(event) => void changeStatus(selected.id, task.id, event.target.value)}>{columns.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></td><td>{PRIORITY[task.priority] ?? task.priority}</td><td>{task.dueAt ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(task.dueAt)) : '—'}</td></tr>)}</tbody></table></section> : <Gantt projectId={selected.id} projectName={selected.name} tasks={filteredTasks.filter((task) => !task.parentTaskId)} members={members} canEdit={canEdit} onOpen={setActiveTask} onSaved={load} onError={(message) => setError(message)} />
              )}
            </div>
          )}
        </main>
      </div>
      {activeTask && selected && <TaskDrawer task={activeTask} projectId={selected.id} tasks={projectTasks} members={members} comments={comments} canEdit={canEdit} canCreate={canCreate} close={() => setActiveTask(null)} refresh={async () => { await load(); setComments(await api<Comment[]>(`/projects/${selected.id}/tasks/${activeTask.id}/comments`)); }} onTaskChanged={(task) => setActiveTask(task)} onStatus={async (taskId, status) => { await changeStatus(selected.id, taskId, status); setActiveTask((current) => current ? { ...current, status } : current); }} />}
    </div>
  );
}

function Gantt({ projectId, projectName, tasks, members, canEdit, onOpen, onSaved, onError }: { projectId: string; projectName: string; tasks: Task[]; members: Member[]; canEdit: boolean; onOpen: (task: Task) => void; onSaved: () => Promise<void>; onError: (message: string) => void }) {
  const [scale, setScale] = useState<'day' | 'week' | 'month'>('week');
  const [offset, setOffset] = useState(0);
  const [dependencies, setDependencies] = useState<Array<{ taskId: string; dependsOnTaskId: string }>>([]);
  useEffect(() => {
    let active = true;
    setDependencies([]);
    void api<Array<{ taskId: string; dependsOnTaskId: string }>>(`/projects/${projectId}/dependencies`).then((rows) => { if (active) setDependencies(rows); }).catch(() => { if (active) setDependencies([]); });
    return () => { active = false; };
  }, [projectId]);
  const stepDays = scale === 'day' ? 1 : scale === 'week' ? 7 : null;
  const count = scale === 'day' ? 14 : scale === 'week' ? 10 : 6;
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(today);
  if (scale === 'day') start.setUTCDate(start.getUTCDate() - 6 + offset * count);
  else if (scale === 'week') start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7) + offset * count * 7);
  else { start.setUTCDate(1); start.setUTCMonth(start.getUTCMonth() + offset * count - 2); }
  const ticks = Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    if (scale === 'month') date.setUTCMonth(date.getUTCMonth() + index);
    else date.setUTCDate(date.getUTCDate() + index * (stepDays ?? 1));
    return date;
  });
  const end = new Date(start);
  if (scale === 'month') end.setUTCMonth(end.getUTCMonth() + count);
  else end.setUTCDate(end.getUTCDate() + count * (stepDays ?? 1));
  const duration = end.getTime() - start.getTime();
  const position = (raw?: string | null) => raw ? ((new Date(raw).getTime() - start.getTime()) / duration) * 100 : null;
  const indexById = new Map(tasks.map((task, index) => [task.id, index]));
  const scheduled = tasks.filter((task) => task.startsAt || task.dueAt).length;
  const dateText = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' });
  const monthText = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  const tickToday = today.getTime() >= start.getTime() && today.getTime() < end.getTime() ? ((today.getTime() - start.getTime()) / duration) * 100 : null;

  async function saveDate(taskId: string, field: 'startsAt' | 'dueAt', value: string) {
    try { await api(`/projects/${projectId}/tasks/${taskId}`, { method: 'PATCH', body: { [field]: value ? new Date(`${value}T00:00:00.000Z`).toISOString() : null } }); await onSaved(); }
    catch (cause) { onError(cause instanceof Error ? cause.message : 'Não foi possível salvar a data da tarefa.'); }
  }

  return <section className="card overflow-hidden p-3 sm:p-4">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Gantt · {projectName}</p><h3 className="mt-1 text-sm font-semibold">Cronograma do projeto</h3><p className="mt-1 text-[10px] text-muted">As barras usam início e prazo salvos. Datas podem ser alteradas por pessoa com permissão de edição.</p></div><div className="flex flex-wrap items-center gap-2"><button className="btn-ghost" aria-label="Período anterior" onClick={() => setOffset((value) => value - 1)}>←</button><button className="btn-ghost" onClick={() => setOffset(0)}>Hoje</button><button className="btn-ghost" aria-label="Próximo período" onClick={() => setOffset((value) => value + 1)}>→</button><div className="flex rounded-lg border border-line/70 p-0.5">{(['day', 'week', 'month'] as const).map((value) => <button key={value} onClick={() => setScale(value)} className={`rounded-md px-2.5 py-1.5 text-[10px] ${scale === value ? 'bg-primary/15 text-primary' : 'text-muted'}`}>{value === 'day' ? 'Dia' : value === 'week' ? 'Semana' : 'Mês'}</button>)}</div></div></div>
    <div className="mb-3 flex flex-wrap gap-2 text-[10px] text-muted"><span>{tasks.length} tarefas</span><span>·</span><span>{scheduled} com data</span><span>·</span><span>{dependencies.length} dependências registradas</span><span>·</span><span className="text-red-300">{tasks.filter((task) => task.dueAt && new Date(task.dueAt) < now && task.status !== 'DONE').length} atrasadas</span></div>
    <div className="overflow-x-auto"><div className="min-w-[880px]"><div className="grid grid-cols-[270px_minmax(610px,1fr)] border-b border-line/70"><div className="grid grid-cols-[1fr_86px_86px] items-end gap-1 pb-2 pr-2 text-[9px] uppercase tracking-wide text-muted"><span>Tarefa · responsável</span><span>Início</span><span>Prazo</span></div><div className="grid pb-2 text-center text-[9px] text-muted" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>{ticks.map((date) => <span key={date.toISOString()} className="truncate">{scale === 'month' ? monthText.format(date) : dateText.format(date)}</span>)}</div></div>
      {tasks.length === 0 ? <div className="py-8 text-center text-xs text-muted">Nenhuma tarefa corresponde aos filtros.</div> : <div className="relative">{tickToday !== null && <div aria-hidden="true" className="pointer-events-none absolute bottom-0 top-0 z-[3] border-l border-dashed border-primary/60" style={{ left: `calc(270px + (100% - 270px) * ${tickToday / 100})` }} />}<svg aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 top-0 z-[4] h-full" style={{ left: 270, width: 'calc(100% - 270px)' }} viewBox={`0 0 1000 ${tasks.length * 72}`} preserveAspectRatio="none"><defs><marker id="gantt-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#a78bfa" /></marker></defs>{dependencies.map((edge) => { const sourceIndex = indexById.get(edge.dependsOnTaskId); const targetIndex = indexById.get(edge.taskId); if (sourceIndex === undefined || targetIndex === undefined) return null; const source = tasks[sourceIndex]; const target = tasks[targetIndex]; const x1 = position(source.dueAt ?? source.startsAt); const x2 = position(target.startsAt ?? target.dueAt); if (x1 === null || x2 === null) return null; const fromX = Math.max(0, Math.min(1000, x1 * 10)); const toX = Math.max(0, Math.min(1000, x2 * 10)); const fromY = sourceIndex * 72 + 36; const toY = targetIndex * 72 + 36; const bend = Math.max(18, Math.abs(toX - fromX) * 0.4); return <path key={`${edge.taskId}-${edge.dependsOnTaskId}`} d={`M ${fromX} ${fromY} C ${fromX + bend} ${fromY}, ${toX - bend} ${toY}, ${toX} ${toY}`} fill="none" stroke="#a78bfa" strokeOpacity=".75" strokeWidth="2" markerEnd="url(#gantt-arrow)" />; })}</svg><div className="divide-y divide-line/60">{tasks.map((task, index) => {
        const startX = position(task.startsAt);
        const dueX = position(task.dueAt);
        const singleX = startX ?? dueX;
        const barLeft = startX !== null && dueX !== null ? Math.min(startX, dueX) : singleX ?? 0;
        const barWidth = startX !== null && dueX !== null ? Math.max(Math.abs(dueX - startX), 0.8) : 0.8;
        const overdue = !!task.dueAt && new Date(task.dueAt) < now && task.status !== 'DONE';
        const milestoneX = position(task.dueAt ?? task.startsAt);
        const assignee = members.find((member) => member.id === task.assigneeId)?.name;
        return <div key={task.id} className="grid h-[72px] grid-cols-[270px_minmax(610px,1fr)] border-b border-line/50 last:border-b-0"><div className="grid grid-cols-[1fr_86px_86px] items-center gap-1 pr-2"><button onClick={() => onOpen(task)} className="min-w-0 text-left"><span className="block truncate text-[11px] font-medium hover:text-primary">{task.title}{task.isMilestone ? ' ◆' : ''}</span><span className="mt-1 block truncate text-[9px] text-muted">{assignee ?? 'Sem responsável'} · {columns.find((column) => column.id === task.status)?.label ?? task.status}</span></button><input type="date" aria-label={`Início de ${task.title}`} className="input min-w-0 px-1 py-1 text-[9px]" disabled={!canEdit} value={task.startsAt?.slice(0, 10) ?? ''} onChange={(event) => void saveDate(task.id, 'startsAt', event.target.value)} /><input type="date" aria-label={`Prazo de ${task.title}`} className="input min-w-0 px-1 py-1 text-[9px]" disabled={!canEdit} value={task.dueAt?.slice(0, 10) ?? ''} onChange={(event) => void saveDate(task.id, 'dueAt', event.target.value)} /></div><div className="relative h-full bg-[linear-gradient(to_right,rgb(255_255_255_/.05)_1px,transparent_1px)] bg-[length:var(--gantt-cols)_100%]" style={{ '--gantt-cols': `${100 / count}%`, backgroundImage: `linear-gradient(to right, rgb(255 255 255 / .045) 1px, transparent 1px)`, backgroundSize: `${100 / count}% 100%` } as React.CSSProperties}>{startX !== null && dueX !== null && <span className={`absolute top-1/2 z-[2] h-2.5 -translate-y-1/2 rounded-full ${overdue ? 'bg-red-400/80' : task.status === 'DONE' ? 'bg-emerald-400/75' : task.status === 'IN_PROGRESS' ? 'bg-violet-300' : 'bg-violet-500/55'}`} style={{ left: `${Math.max(0, barLeft)}%`, width: `${Math.max(0, Math.min(barWidth, 100 - Math.max(0, barLeft)))}%` }} />}{milestoneX !== null && task.isMilestone && <span aria-label="Marco persistido" className="absolute top-1/2 z-[2] h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-amber-200 bg-amber-400" style={{ left: `${milestoneX}%` }} />}{singleX !== null && (startX === null || dueX === null) && <span className={`absolute top-1/2 z-[2] h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${overdue ? 'bg-red-400' : 'bg-violet-300'}`} style={{ left: `${singleX}%` }} />}</div></div>;
      })}</div></div>}</div></div>
    {!scheduled && tasks.length > 0 && <p className="mt-3 rounded-lg border border-amber-300/10 bg-amber-300/[0.04] p-3 text-[10px] text-amber-100/80">Tarefas sem datas não recebem barras estimadas. Defina início e prazo para posicioná-las no cronograma.</p>}
  </section>;
}

function TaskDrawer({ task, projectId, tasks, members, comments, canEdit, canCreate, close, refresh, onTaskChanged, onStatus }: { task: Task; projectId: string; tasks: Task[]; members: Member[]; comments: Comment[]; canEdit: boolean; canCreate: boolean; close: () => void; refresh: () => Promise<void>; onTaskChanged: (task: Task) => void; onStatus: (taskId: string, status: string) => Promise<void> }) {
  const { can } = useAuth();
  const canAssign = can('workforce', 'view');
  const [dependencies, setDependencies] = useState<Array<{ dependsOnTaskId: string }>>([]);
  const [dependencyId, setDependencyId] = useState('');
  const children = tasks.filter((item) => item.parentTaskId === task.id);
  const refreshDependencies = async () => setDependencies(await api(`/projects/${projectId}/tasks/${task.id}/dependencies`));
  useEffect(() => { void refreshDependencies(); }, [projectId, task.id]);
  async function submitTaskEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const updated = await api<Task>(`/projects/${projectId}/tasks/${task.id}`, { method: 'PATCH', body: { title: String(form.get('title')), description: String(form.get('description')), status: String(form.get('status')), priority: String(form.get('priority')), ...(canAssign ? { assigneeId: String(form.get('assigneeId') || '') || null } : {}), startsAt: String(form.get('startsAt') || '') || null, dueAt: String(form.get('dueAt') || '') || null, isMilestone: form.get('isMilestone') === 'on', labels: String(form.get('labels') || '').split(',').map((label) => label.trim()).filter(Boolean) } });
    onTaskChanged({ ...task, ...updated });
    await refresh();
  }
  return <div className="fixed inset-0 z-50 flex justify-end bg-black/60" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><aside className="h-full w-full max-w-lg overflow-y-auto border-l border-line bg-background p-5 shadow-2xl" role="dialog" aria-modal="true" aria-label={`Tarefa: ${task.title}`}><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Detalhes da tarefa</p><h2 className="mt-1 text-lg font-semibold">{task.title}</h2></div><button className="icon-button" onClick={close} aria-label="Fechar">×</button></div>
    <form className="mt-5 space-y-2" onSubmit={submitTaskEdit}><label className="block text-xs text-muted">Título<input name="title" className="input mt-1 w-full" defaultValue={task.title} required disabled={!canEdit} /></label><label className="block text-xs text-muted">Descrição<textarea name="description" className="input mt-1 min-h-20 w-full" defaultValue={task.description ?? ''} disabled={!canEdit} /></label><div className="grid grid-cols-2 gap-2"><label className="text-xs text-muted">Status<select name="status" className="input mt-1 w-full" defaultValue={task.status} disabled={!canEdit}>{columns.map((column) => <option key={column.id} value={column.id}>{column.label}</option>)}</select></label><label className="text-xs text-muted">Prioridade<select name="priority" className="input mt-1 w-full" defaultValue={task.priority} disabled={!canEdit}>{Object.entries(PRIORITY).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>{canAssign && <label className="block text-xs text-muted">Responsável<select name="assigneeId" className="input mt-1 w-full" defaultValue={task.assigneeId ?? ''} disabled={!canEdit}><option value="">Sem responsável</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>}<div className="grid grid-cols-2 gap-2"><label className="text-xs text-muted">Início<input name="startsAt" type="date" className="input mt-1 w-full" defaultValue={task.startsAt?.slice(0, 10) ?? ''} disabled={!canEdit} /></label><label className="text-xs text-muted">Prazo<input name="dueAt" type="date" className="input mt-1 w-full" defaultValue={task.dueAt?.slice(0, 10) ?? ''} disabled={!canEdit} /></label></div><label className="flex items-center gap-2 text-xs text-muted"><input name="isMilestone" type="checkbox" defaultChecked={task.isMilestone} disabled={!canEdit} />Marco do projeto</label><label className="block text-xs text-muted">Etiquetas<input name="labels" className="input mt-1 w-full" defaultValue={(task.labels ?? []).join(', ')} disabled={!canEdit} /></label>{canEdit && <button className="btn">Salvar alterações</button>}</form>
    <div className="mt-6 flex items-center justify-between"><h3 className="text-sm font-semibold">Subtarefas <span className="text-muted">{children.filter((child) => child.status === 'DONE').length}/{children.length}</span></h3></div><ul className="mt-2 space-y-1">{children.map((child) => <li key={child.id} className="flex items-center gap-2 rounded border border-line p-2"><input type="checkbox" checked={child.status === 'DONE'} aria-label={`Concluir ${child.title}`} disabled={!canEdit} onChange={() => void onStatus(child.id, child.status === 'DONE' ? 'TODO' : 'DONE')} /><span className="min-w-0 flex-1 text-xs">{child.title}</span>{canEdit && <button className="text-[10px] text-red-300" onClick={async () => { await api(`/projects/${projectId}/tasks/${child.id}`, { method: 'DELETE' }); await refresh(); }}>Excluir</button>}</li>)}</ul>{canCreate && <form className="mt-2 flex gap-2" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); await api(`/projects/${projectId}/tasks`, { method: 'POST', body: { title: String(form.get('title')), parentTaskId: task.id } }); event.currentTarget.reset(); await refresh(); }}><input name="title" className="input min-w-0 flex-1" placeholder="Nova subtarefa" required /><button className="btn">Adicionar</button></form>}
    <h3 className="mt-6 text-sm font-semibold">Dependências</h3><ul className="mt-2 space-y-1">{dependencies.map((dependency) => { const related = tasks.find((item) => item.id === dependency.dependsOnTaskId); return <li key={dependency.dependsOnTaskId} className="flex items-center gap-2 rounded border border-line p-2"><span className="min-w-0 flex-1 text-xs">{related?.title ?? 'Tarefa relacionada'}</span><span className="text-[10px] text-muted">{related?.status === 'DONE' ? 'Concluída' : 'Bloqueio'}</span>{canEdit && <button className="text-[10px] text-red-300" onClick={async () => { await api(`/projects/${projectId}/tasks/${task.id}/dependencies/${dependency.dependsOnTaskId}`, { method: 'DELETE' }); await refreshDependencies(); }}>Remover</button>}</li>; })}</ul>{canEdit && <form className="mt-2 flex gap-2" onSubmit={async (event) => { event.preventDefault(); if (!dependencyId) return; await api(`/projects/${projectId}/tasks/${task.id}/dependencies`, { method: 'POST', body: { dependsOnTaskId: dependencyId } }); setDependencyId(''); await refreshDependencies(); }}><select className="input min-w-0 flex-1" value={dependencyId} onChange={(event) => setDependencyId(event.target.value)}><option value="">Adicionar dependência…</option>{tasks.filter((item) => item.id !== task.id && item.parentTaskId == null && !dependencies.some((dependency) => dependency.dependsOnTaskId === item.id)).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><button className="btn" disabled={!dependencyId}>Adicionar</button></form>}
    <h3 className="mt-6 text-sm font-semibold">Comentários</h3><ul className="mt-2 space-y-2">{comments.map((comment) => <CommentItem key={comment.id} comment={comment} projectId={projectId} taskId={task.id} canEdit={canEdit} refresh={refresh} />)}</ul><form className="mt-3 space-y-2" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); await api(`/projects/${projectId}/tasks/${task.id}/comments`, { method: 'POST', body: { body: String(form.get('body')) } }); event.currentTarget.reset(); await refresh(); }}><textarea name="body" className="input min-h-24 w-full" placeholder="Escreva um comentário…" required maxLength={10000} /><button className="btn" disabled={!canEdit}>Comentar</button></form></aside></div>;
}

function CommentItem({ comment, projectId, taskId, canEdit, refresh }: { comment: Comment; projectId: string; taskId: string; canEdit: boolean; refresh: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const { user } = useAuth();
  const isAuthor = comment.authorId === user?.id;
  const canDelete = isAuthor || ['OWNER', 'ADMIN', 'MANAGER'].includes(user?.role ?? '');
  return <li className="rounded-lg border border-line p-3"><p className="text-[10px] font-medium text-muted">{comment.author?.name ?? 'Colaborador'}</p>{editing ? <form onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); await api(`/projects/${projectId}/tasks/${taskId}/comments/${comment.id}`, { method: 'PATCH', body: { body: String(form.get('body')) } }); setEditing(false); await refresh(); }}><textarea name="body" className="input mt-2 min-h-20 w-full" defaultValue={comment.body} maxLength={10000} required /><button className="btn mt-2">Salvar</button></form> : <p className="mt-1 whitespace-pre-wrap text-xs">{comment.body}</p>}<div className="mt-2 flex items-center gap-3"><time className="text-[10px] text-muted">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(comment.createdAt))}</time>{!editing && <>{canEdit && isAuthor && <button className="text-[10px] text-primary" onClick={() => setEditing(true)}>Editar</button>}{canEdit && canDelete && <button className="text-[10px] text-red-300" onClick={async () => { await api(`/projects/${projectId}/tasks/${taskId}/comments/${comment.id}`, { method: 'DELETE' }); await refresh(); }}>Excluir</button>}</>}</div></li>;
}
