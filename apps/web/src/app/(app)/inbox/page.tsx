'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

type Notification = { id: string; title: string; body: string; href: string | null; readAt: string | null; createdAt: string };

export default function InboxPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try { setItems(await api<Notification[]>('/notifications')); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erro ao carregar notificações'); }
  }
  useEffect(() => { void load(); }, []);

  async function read(id: string) {
    await api(`/notifications/${id}/read`, { method: 'PATCH' });
    await load();
  }

  async function readAll() {
    await api('/notifications/read-all', { method: 'PATCH' });
    await load();
  }

  const filtered = items.filter((item) => filter === 'all' || !item.readAt);
  return (
    <div className="space-y-4">
      <header className="page-heading"><div><p className="eyebrow">Central de operações</p><h1>Caixa de entrada</h1></div><button className="btn-ghost" onClick={() => void readAll()} disabled={!items.some((item) => !item.readAt)}>Marcar tudo como lido</button></header>
      {error && <p className="error-state" role="alert">{error}</p>}
      <section className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line/70 p-3"><button className={filter === 'all' ? 'btn' : 'btn-ghost'} onClick={() => setFilter('all')}>Todas</button><button className={filter === 'unread' ? 'btn' : 'btn-ghost'} onClick={() => setFilter('unread')}>Não lidas · {items.filter((item) => !item.readAt).length}</button></div>
        <ul className="compact-list">{filtered.map((item) => <li key={item.id}>
          <div className="flex items-start gap-3">
            <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.readAt ? 'bg-muted/30' : 'bg-primary'}`} />
            <div className="min-w-0 flex-1">{item.href ? <Link href={item.href} onClick={() => void read(item.id)} className="font-medium hover:text-primary">{item.title}</Link> : <p className="font-medium">{item.title}</p>}<p className="mt-1 text-xs text-muted">{item.body}</p><time className="mt-2 block text-[10px] text-muted">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.createdAt))}</time></div>
            {!item.readAt && <button className="btn-ghost" onClick={() => void read(item.id)}>Lida</button>}
          </div>
        </li>)}{filtered.length === 0 && <li className="py-10 text-center text-xs text-muted">Nenhuma notificação nesta visão</li>}</ul>
      </section>
    </div>
  );
}
