'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { ROLE_LABEL } from '@/lib/roles';
import { useAuth } from '@/components/auth-provider';
import type { Role } from '@/lib/types';

type Action = 'view' | 'create' | 'edit' | 'delete' | 'manage' | 'approve' | 'export' | 'invite';
type Permission = { role: Role; module: string; action: Action; enabled: boolean; inherited: boolean };
type Matrix = { roles: Role[]; modules: string[]; actions: Action[]; permissions: Permission[] };
type Change = Pick<Permission, 'role' | 'module' | 'action' | 'enabled'>;

const ACTION_LABEL: Record<Action, string> = { view: 'Ver', create: 'Criar', edit: 'Editar', delete: 'Excluir', manage: 'Gerenciar', approve: 'Aprovar', export: 'Exportar', invite: 'Convidar' };

export default function PermissionsPage() {
  const { user } = useAuth();
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [role, setRole] = useState<Role>('ADMIN');
  const [pending, setPending] = useState<Change[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    try {
      const result = await api<Matrix>('/permissions');
      setMatrix(result);
      setRole(result.roles.includes('ADMIN') ? 'ADMIN' : result.roles[0]);
      setError('');
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Não foi possível carregar permissões'); }
  }, [reloadKey]);
  useEffect(() => { void load(); }, [load]);

  const visibleRoles = useMemo(() => matrix?.roles.filter((item) => item !== 'SUPER_ADMIN' && (user?.role === 'SUPER_ADMIN' || item !== 'OWNER')) ?? [], [matrix, user?.role]);
  const getPermission = (module: string, action: Action) => matrix?.permissions.find((item) => item.role === role && item.module === module && item.action === action);
  const pendingValue = (module: string, action: Action) => pending.find((item) => item.role === role && item.module === module && item.action === action)?.enabled ?? getPermission(module, action)?.enabled ?? false;

  function toggle(module: string, action: Action) {
    const enabled = !pendingValue(module, action);
    setPending((items) => [...items.filter((item) => !(item.role === role && item.module === module && item.action === action)),
      { role, module, action, enabled }].filter((item) => item.enabled !== matrix?.permissions.find((entry) => entry.role === item.role && entry.module === item.module && entry.action === item.action)?.enabled));
    setNotice('');
  }

  async function save() {
    if (!pending.length || busy) return;
    if (!window.confirm(`Salvar ${pending.length} alteração(ões) para ${ROLE_LABEL[role]}?`)) return;
    setBusy(true); setError('');
    try {
      for (const change of pending) await api('/permissions', { method: 'PATCH', body: change });
      setPending([]); setNotice('Permissões salvas e registradas na auditoria.'); setReloadKey((value) => value + 1);
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Falha ao salvar permissões'); }
    finally { setBusy(false); }
  }

  if (user?.role !== 'OWNER' && user?.role !== 'SUPER_ADMIN') return <section className="card p-5"><h1 className="text-lg font-semibold">Acesso restrito</h1><p className="mt-2 text-sm text-muted">Somente o proprietário da empresa pode gerenciar permissões.</p></section>;

  return <div className="space-y-4">
    <header className="page-heading"><div><p className="eyebrow">Administração</p><h1>Permissões</h1><p className="mt-1 text-xs text-muted">Permissões padrão podem ser substituídas por empresa. As alterações são validadas no servidor e auditadas.</p></div></header>
    {error && <p className="error-state" role="alert">{error}</p>}{notice && <p className="status-success" role="status">{notice}</p>}
    <section className="card space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><label className="text-xs text-muted">Papel<select className="input ml-2" value={role} onChange={(event) => setRole(event.target.value as Role)}>{visibleRoles.map((item) => <option key={item} value={item}>{ROLE_LABEL[item]}</option>)}</select></label><div className="flex items-center gap-2"><span className="text-xs text-muted">{pending.length} alteração(ões)</span><button className="btn" disabled={!pending.length || busy} onClick={() => void save()}>{busy ? 'Salvando…' : 'Revisar e salvar'}</button></div></div>
      {!matrix ? <p className="py-8 text-center text-sm text-muted">Carregando matriz…</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead><tr className="border-b border-line text-muted"><th className="py-2">Módulo</th>{matrix.actions.map((action) => <th key={action} className="px-2 py-2 text-center">{ACTION_LABEL[action]}</th>)}</tr></thead><tbody>{matrix.modules.map((module) => <tr key={module} className="border-b border-line/50"><th className="py-2 font-medium capitalize">{module}</th>{matrix.actions.map((action) => { const current = getPermission(module, action); return <td key={action} className="px-2 py-2 text-center"><label className="inline-flex items-center gap-1.5" title={current?.inherited ? 'Permissão herdada do padrão' : 'Substituição desta empresa'}><input type="checkbox" checked={pendingValue(module, action)} onChange={() => toggle(module, action)} /><span className="text-[10px] text-muted">{current?.inherited ? 'padrão' : 'custom'}</span></label></td>; })}</tr>)}</tbody></table></div>}
    </section>
  </div>;
}
