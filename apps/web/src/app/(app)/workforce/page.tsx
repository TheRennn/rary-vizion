'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth-provider';
import { api } from '@/lib/api';
import { ROLE_LABEL, ROLE_RANK, hasMinRole } from '@/lib/roles';
import type { Department, Employee, Role } from '@/lib/types';

export default function WorkforcePage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [roleFilter, setRoleFilter] = useState('all');
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [editing, setEditing] = useState<Employee | null>(null);

  const canManage = !!user && hasMinRole(user.role, 'ADMIN');
  const filteredEmployees = useMemo(() => (employees ?? []).filter((employee) => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    const matchesSearch = !query || `${employee.name} ${employee.email} ${employee.jobTitle ?? ''} ${employee.department?.name ?? ''}`
      .toLocaleLowerCase('pt-BR').includes(query);
    const matchesDepartment = departmentFilter === 'all' || employee.department?.id === departmentFilter;
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? employee.active : !employee.active);
    const matchesRole = roleFilter === 'all' || employee.role === roleFilter;
    return matchesSearch && matchesDepartment && matchesStatus && matchesRole;
  }), [employees, search, departmentFilter, statusFilter, roleFilter]);

  const load = useCallback(async () => {
    try {
      const [e, d] = await Promise.all([api<Employee[]>('/users'), api<Department[]>('/departments')]);
      setEmployees(e);
      setDepartments(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user) return null;

  // Só oferece papéis abaixo do próprio (a API também valida).
  const assignableRoles = (Object.keys(ROLE_RANK) as Role[]).filter((r) => ROLE_RANK[r] < ROLE_RANK[user.role]);

  async function submit(path: string, body: unknown, form: HTMLFormElement, method: 'POST' | 'PATCH' = 'POST') {
    setSubmitting(true);
    setError(null);
    try {
      await api(path, { method, body });
      form.reset();
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSubmitting(false);
    }
  }

  async function setEmployeeActive(employee: Employee) {
    const nextActive = !employee.active;
    if (!nextActive && !window.confirm(`Arquivar ${employee.name}? A conta perderá acesso à plataforma.`)) return;
    setSubmitting(true);
    setError(null);
    try {
      await api(`/users/${employee.id}`, { method: 'PATCH', body: { active: nextActive } });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar colaborador');
    } finally {
      setSubmitting(false);
    }
  }

  function onUpdateUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const f = new FormData(e.currentTarget);
    const departmentId = String(f.get('departmentId') ?? '');
    const jobTitle = String(f.get('jobTitle') ?? '').trim();
    void submit(`/users/${editing.id}`, {
      name: String(f.get('name')),
      role: String(f.get('role')),
      departmentId: departmentId || null,
      jobTitle: jobTitle || null,
    }, e.currentTarget, 'PATCH');
  }

  function onCreateUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const departmentId = String(f.get('departmentId') ?? '');
    const jobTitle = String(f.get('jobTitle') ?? '').trim();
    void submit(
      '/users',
      {
        name: String(f.get('name')),
        email: String(f.get('email')),
        password: String(f.get('password')),
        role: String(f.get('role')),
        ...(departmentId ? { departmentId } : {}),
        ...(jobTitle ? { jobTitle } : {}),
      },
      e.currentTarget,
    );
  }

  function onCreateDepartment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void submit('/departments', { name: String(f.get('name')) }, e.currentTarget);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <p className="eyebrow mb-2">Gestão de pessoas</p>
          <h1 className="text-3xl font-semibold tracking-tight">Workforce</h1>
          <p className="mt-1 text-sm text-muted">{user.company.name}</p>
        </div>
        <span className="hidden rounded-xl border border-line px-3 py-2 text-xs text-muted sm:block">{filteredEmployees.length} de {employees?.length ?? 0} pessoas</span>
      </header>

      {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-300">{error}</p>}

      <section className="card space-y-4 p-4 sm:p-5" aria-label="Filtros de colaboradores">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)_repeat(3,minmax(9rem,13rem))_auto]">
          <label className="sr-only" htmlFor="workforce-search">Buscar colaboradores</label>
          <input id="workforce-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nome, e-mail, cargo..." className="input" />
          <label className="sr-only" htmlFor="workforce-department">Departamento</label>
          <select id="workforce-department" className="input" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
            <option value="all">Todos departamentos</option>
            {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
          <label className="sr-only" htmlFor="workforce-status">Status</label>
          <select id="workforce-status" className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="active">Ativos</option><option value="inactive">Arquivados</option><option value="all">Todos os status</option>
          </select>
          <label className="sr-only" htmlFor="workforce-role">Papel</label>
          <select id="workforce-role" className="input" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="all">Todos os papéis</option>
            {(Object.keys(ROLE_LABEL) as Role[]).map((role) => <option key={role} value={role}>{ROLE_LABEL[role]}</option>)}
          </select>
          <div className="flex gap-2" role="group" aria-label="Modo de visualização">
            <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')} className={view === 'table' ? 'btn h-11 px-3' : 'btn-ghost h-11 px-3'}>Tabela</button>
            <button type="button" aria-pressed={view === 'cards'} onClick={() => setView('cards')} className={view === 'cards' ? 'btn h-11 px-3' : 'btn-ghost h-11 px-3'}>Cards</button>
          </div>
        </div>
        {departments.length > 0 && <div className="flex flex-wrap gap-2" aria-label="Resumo por departamento">
          {departments.map((department) => <button key={department.id} type="button" onClick={() => setDepartmentFilter(departmentFilter === department.id ? 'all' : department.id)} className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${departmentFilter === department.id ? 'border-primary/60 bg-primary/10 text-fg' : 'border-line text-muted hover:border-primary/40'}`}>{department.name} · {department._count.users}</button>)}
        </div>}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <section className="card overflow-x-auto">
          <div className="flex items-center justify-between border-b border-line/80 px-5 py-4">
            <div>
              <p className="eyebrow">Diretório</p>
              <h2 className="mt-1 text-sm font-semibold">Colaboradores</h2>
            </div>
            <span className="text-xs text-muted">{filteredEmployees.length} resultado{filteredEmployees.length === 1 ? '' : 's'}</span>
          </div>
          {employees === null ? <p className="p-5 text-sm text-muted">Carregando colaboradores…</p> : filteredEmployees.length === 0 ? <div className="p-8 text-center"><p className="font-medium">Nenhum colaborador encontrado</p><p className="mt-1 text-sm text-muted">Ajuste os filtros ou limpe a busca.</p><button type="button" className="btn-ghost mt-4" onClick={() => { setSearch(''); setDepartmentFilter('all'); setRoleFilter('all'); setStatusFilter('all'); }}>Limpar filtros</button></div> : view === 'cards' ? (
            <div className="grid gap-3 p-4 sm:grid-cols-2 2xl:grid-cols-3">{filteredEmployees.map((employee) => <article key={employee.id} className="rounded-xl border border-line/80 bg-surface2/35 p-4">
              <div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{employee.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}</div><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold">{employee.name}</h3><p className="truncate text-xs text-muted">{employee.email}</p></div><span className={`rounded-full px-2 py-1 text-[10px] ${employee.active ? 'bg-emerald-400/10 text-emerald-300' : 'bg-surface text-muted'}`}>{employee.active ? 'Ativo' : 'Arquivado'}</span></div>
              <div className="mt-4 space-y-2 border-t border-line/70 pt-3 text-xs"><p><span className="text-muted">Cargo</span><span className="float-right">{employee.jobTitle ?? '—'}</span></p><p><span className="text-muted">Departamento</span><span className="float-right">{employee.department?.name ?? '—'}</span></p><p><span className="text-muted">Papel</span><span className="float-right">{ROLE_LABEL[employee.role]}</span></p></div>
              {canManage && ROLE_RANK[employee.role] < ROLE_RANK[user.role] && <div className="mt-4 flex gap-2 border-t border-line/70 pt-3"><button type="button" className="btn-ghost flex-1 py-2" onClick={() => setEditing(employee)}>Editar</button><button type="button" className="btn-ghost flex-1 py-2" disabled={submitting} onClick={() => void setEmployeeActive(employee)}>{employee.active ? 'Arquivar' : 'Reativar'}</button></div>}
            </article>)}</div>
          ) : <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-line/70 text-[11px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Nome</th>
                <th className="px-5 py-3 font-medium">Papel</th>
                <th className="px-5 py-3 font-medium">Departamento</th>
                <th className="px-5 py-3 font-medium">Cargo</th>
                {canManage && <th className="px-5 py-3 font-medium">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {employees === null ? (
                <tr><td colSpan={canManage ? 5 : 4} className="px-5 py-5 text-muted">Carregando colaboradores…</td></tr>
              ) : (
                filteredEmployees.map((e) => (
                  <tr key={e.id} className="transition-colors hover:bg-white/[0.025]">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {e.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                        </div>
                        <div>
                          <p className="font-medium">{e.name}</p>
                          <p className="text-xs text-muted">{e.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5"><span className="rounded-md border border-line bg-surface2/60 px-2 py-1 text-xs">{ROLE_LABEL[e.role]}</span><span className={`ml-2 rounded-full px-2 py-1 text-[10px] ${e.active ? 'bg-emerald-400/10 text-emerald-300' : 'bg-surface text-muted'}`}>{e.active ? 'Ativo' : 'Arquivado'}</span></td>
                    <td className="px-5 py-3.5 text-muted">{e.department?.name ?? '—'}</td>
                    <td className="px-5 py-3.5 text-muted">{e.jobTitle ?? '—'}</td>
                    {canManage && <td className="px-5 py-3.5">{ROLE_RANK[e.role] < ROLE_RANK[user.role] && <div className="flex gap-2"><button type="button" className="text-xs text-primary hover:text-fg" onClick={() => setEditing(e)}>Editar</button><button type="button" disabled={submitting} className="text-xs text-muted hover:text-red-300" onClick={() => void setEmployeeActive(e)}>{e.active ? 'Arquivar' : 'Reativar'}</button></div>}</td>}
                  </tr>
                ))
              )}
            </tbody>
          </table>}
        </section>

        {canManage && (
          <div className="space-y-6">
            <form onSubmit={onCreateUser} className="card space-y-3 p-5">
              <div>
                <p className="eyebrow">Cadastro</p>
                <h2 className="mt-1 text-sm font-semibold">Novo colaborador</h2>
              </div>
              <input name="name" placeholder="Nome" required minLength={2} className="input" />
              <input name="email" type="email" placeholder="E-mail" required className="input" />
              <input name="password" type="password" placeholder="Senha inicial (mín. 8)" required minLength={8} maxLength={72} className="input" />
              <input name="jobTitle" placeholder="Cargo (opcional)" maxLength={80} className="input" />
              <select name="role" defaultValue="DEVELOPER" className="input" aria-label="Papel">
                {assignableRoles.map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </select>
              <select name="departmentId" defaultValue="" className="input" aria-label="Departamento">
                <option value="">Sem departamento</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <button className="btn w-full" disabled={submitting}>Adicionar colaborador</button>
            </form>

            <form onSubmit={onCreateDepartment} className="card space-y-3 p-5">
              <div>
                <p className="eyebrow">Organização</p>
                <h2 className="mt-1 text-sm font-semibold">Novo departamento</h2>
              </div>
              <input name="name" placeholder="Ex.: Backend" required minLength={2} maxLength={60} className="input" />
              <button className="btn-ghost w-full" disabled={submitting}>Criar departamento</button>
            </form>
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}>
          <form role="dialog" aria-modal="true" aria-labelledby="edit-employee-title" onSubmit={onUpdateUser} className="card w-full max-w-lg space-y-4 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Gestão de pessoas</p><h2 id="edit-employee-title" className="mt-1 text-lg font-semibold">Editar colaborador</h2></div><button type="button" className="rounded-lg px-2 py-1 text-muted hover:bg-surface2" onClick={() => setEditing(null)} aria-label="Fechar edição">×</button></div>
            <label className="block space-y-1.5 text-sm"><span>Nome</span><input name="name" defaultValue={editing.name} required minLength={2} maxLength={80} className="input" /></label>
            <div className="grid gap-3 sm:grid-cols-2"><label className="block space-y-1.5 text-sm"><span>Cargo</span><input name="jobTitle" defaultValue={editing.jobTitle ?? ''} maxLength={80} className="input" /></label><label className="block space-y-1.5 text-sm"><span>Papel</span><select name="role" defaultValue={editing.role} className="input">{assignableRoles.map((role) => <option key={role} value={role}>{ROLE_LABEL[role]}</option>)}</select></label></div>
            <label className="block space-y-1.5 text-sm"><span>Departamento</span><select name="departmentId" defaultValue={editing.department?.id ?? ''} className="input"><option value="">Sem departamento</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
            <div className="flex justify-end gap-2 border-t border-line pt-4"><button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancelar</button><button type="submit" className="btn" disabled={submitting}>{submitting ? 'Salvando…' : 'Salvar alterações'}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
