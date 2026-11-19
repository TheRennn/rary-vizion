'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
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

  const canManage = !!user && hasMinRole(user.role, 'ADMIN');

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

  async function submit(path: string, body: unknown, form: HTMLFormElement) {
    setSubmitting(true);
    setError(null);
    try {
      await api(path, { method: 'POST', body });
      form.reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSubmitting(false);
    }
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
        {canManage && <span className="hidden rounded-xl border border-line px-3 py-2 text-xs text-muted sm:block">{employees?.length ?? 0} pessoas</span>}
      </header>

      {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-300">{error}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <section className="card overflow-x-auto">
          <div className="flex items-center justify-between border-b border-line/80 px-5 py-4">
            <div>
              <p className="eyebrow">Diretório</p>
              <h2 className="mt-1 text-sm font-semibold">Colaboradores</h2>
            </div>
          </div>
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-line/70 text-[11px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Nome</th>
                <th className="px-5 py-3 font-medium">Papel</th>
                <th className="px-5 py-3 font-medium">Departamento</th>
                <th className="px-5 py-3 font-medium">Cargo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {employees === null ? (
                <tr><td colSpan={4} className="px-5 py-5 text-muted">Carregando colaboradores…</td></tr>
              ) : (
                employees.map((e) => (
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
                    <td className="px-5 py-3.5"><span className="rounded-md border border-line bg-surface2/60 px-2 py-1 text-xs">{ROLE_LABEL[e.role]}</span></td>
                    <td className="px-5 py-3.5 text-muted">{e.department?.name ?? '—'}</td>
                    <td className="px-5 py-3.5 text-muted">{e.jobTitle ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
    </div>
  );
}
