'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

type Task = { id: string; title: string; description: string | null; status: string; priority: string; assigneeId: string | null };
type Project = { id: string; name: string; description: string | null; status: string; dueAt: string | null; tasks: Task[] };

const columns = [
  { id: 'TODO', label: 'A fazer' },
  { id: 'IN_PROGRESS', label: 'Em andamento' },
  { id: 'REVIEW', label: 'Em revisão' },
  { id: 'DONE', label: 'Concluído' },
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [view, setView] = useState<'board' | 'list'>('board');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const data = await api<Project[]>('/projects');
      setProjects(data);
      setSelectedId((current) => current || data[0]?.id || '');
      setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao carregar projetos'); }
  };
  useEffect(() => { void load(); }, []);
  const selected = projects.find((project) => project.id === selectedId) ?? null;
  const projectTasks = useMemo(() => selected?.tasks ?? [], [selected]);

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
      await api(`/projects/${selected.id}/tasks`, { method: 'POST', body: { title: String(form.get('title')).trim(), status: String(form.get('status')), priority: String(form.get('priority')) } });
      event.currentTarget.reset();
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao criar tarefa'); } finally { setBusy(false); }
  }

  async function changeStatus(projectId: string, taskId: string, status: string) {
    try {
      await api(`/projects/${projectId}/tasks/${taskId}`, { method: 'PATCH', body: { status } });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao atualizar tarefa'); }
  }

  return (
    <div className="space-y-4">
      <header className="page-heading">
        <div><p className="eyebrow">Gestão operacional</p><h1>Projects</h1></div>
        <div className="flex gap-2">
          <button className={view === 'board' ? 'btn' : 'btn-ghost'} onClick={() => setView('board')}>Kanban</button>
          <button className={view === 'list' ? 'btn' : 'btn-ghost'} onClick={() => setView('list')}>Lista</button>
        </div>
      </header>
      {error && <p className="error-state" role="alert">{error}</p>}
      <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="card p-3">
          <form onSubmit={createProject} className="space-y-2 border-b border-line/70 pb-3">
            <input name="name" className="input w-full" placeholder="Novo projeto" required />
            <input name="description" className="input w-full" placeholder="Descrição" />
            <input name="dueAt" type="date" className="input w-full" />
            <button className="btn w-full" disabled={busy}>Criar projeto</button>
          </form>
          <nav className="compact-list mt-2">
            {projects.map((project) => (
              <li key={project.id}>
                <button className={`w-full text-left ${selectedId === project.id ? 'text-primary' : ''}`} onClick={() => setSelectedId(project.id)}>
                  <span className="block truncate text-sm font-medium">{project.name}</span>
                  <span className="mt-1 block text-[10px] text-muted">{project.tasks.length} tarefas · {project.status}</span>
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
                  <select className="input" value={selected.status} onChange={async (event) => { await api(`/projects/${selected.id}`, { method: 'PATCH', body: { status: event.target.value } }); await load(); }}>
                    {['PLANNING','ACTIVE','ON_HOLD','COMPLETED','ARCHIVED'].map((status) => <option key={status}>{status}</option>)}
                  </select>
                </div>
              </section>
              <form onSubmit={createTask} className="filter-bar">
                <input name="title" className="input min-w-[220px] flex-1" placeholder="Nova tarefa" required />
                <select name="status" className="input" defaultValue="TODO">{columns.map((column) => <option key={column.id} value={column.id}>{column.label}</option>)}</select>
                <select name="priority" className="input" defaultValue="MEDIUM"><option value="LOW">Baixa</option><option value="MEDIUM">Média</option><option value="HIGH">Alta</option><option value="URGENT">Urgente</option></select>
                <button className="btn" disabled={busy}>Adicionar</button>
              </form>
              {view === 'board' ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {columns.map((column) => (
                    <section key={column.id} className="card min-h-64 p-3">
                      <div className="mb-3 flex justify-between text-xs"><span className="font-medium">{column.label}</span><span className="text-muted">{projectTasks.filter((task) => task.status === column.id).length}</span></div>
                      <div className="space-y-2">{projectTasks.filter((task) => task.status === column.id).map((task) => <article key={task.id} className="rounded-lg border border-line/70 bg-surface2/30 p-3">
                        <p className="text-sm font-medium">{task.title}</p><p className="mt-2 text-[10px] text-muted">{task.priority}</p>
                        <select className="input mt-3 w-full" value={task.status} onChange={(event) => void changeStatus(selected.id, task.id, event.target.value)}>{columns.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
                      </article>)}</div>
                    </section>
                  ))}
                </div>
              ) : (
                <section className="card overflow-hidden"><table className="data-table"><thead><tr><th>Tarefa</th><th>Status</th><th>Prioridade</th></tr></thead><tbody>{projectTasks.map((task) => <tr key={task.id}><td>{task.title}</td><td><select className="input" value={task.status} onChange={(event) => void changeStatus(selected.id, task.id, event.target.value)}>{columns.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></td><td>{task.priority}</td></tr>)}</tbody></table></section>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
