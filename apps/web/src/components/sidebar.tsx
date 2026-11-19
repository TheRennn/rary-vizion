'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './auth-provider';
import { BrandIcon } from './brand-icon';
import { ROLE_LABEL } from '@/lib/roles';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: 'grid' },
  { href: '/time', label: 'Vizion Time', icon: 'clock' },
  { href: '/audit', label: 'Auditoria', icon: 'shield', admin: true },
  { href: '/workforce', label: 'Equipe', icon: 'users' },
  { href: '/chat', label: 'Chat', icon: 'chat' },
  { href: '/projects', label: 'Operações', icon: 'folder', soon: true },
  { href: '/voice', label: 'Chamada', icon: 'mic', soon: true },
  { href: '/meetings', label: 'Reunião', icon: 'video', soon: true },
  { href: '/monitor', label: 'Central', icon: 'activity', soon: true },
  { href: '/intelligence', label: 'IA Vizion', icon: 'spark', soon: true },
];

function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    chat: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /><path d="M8 9h8M8 13h5" /></>,
    mic: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" /></>,
    video: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3z" /></>,
    activity: <path d="M3 12h4l2-7 4 14 2-7h6" />,
    folder: <path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
    spark: <><path d="m12 3-1.8 5.2L5 10l5.2 1.8L12 17l1.8-5.2L19 10l-5.2-1.8z" /><path d="M19 17l-.7 2.3L16 20l2.3.7L19 23l.7-2.3L22 20l-2.3-.7z" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">{paths[name]}</svg>;
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const isAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const closeOnDesktop = () => {
      if (window.innerWidth >= 768) setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnDesktop);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeOnDesktop);
    };
  }, [open]);

  const sidebar = (
    <aside className="glass flex h-screen h-[100dvh] w-[260px] shrink-0 flex-col overflow-hidden border-y-0 border-l-0 px-3 py-4">
      <div className="mb-5 flex items-center gap-3 px-2 py-1">
        <div className="grid h-9 w-9 place-items-center rounded-xl border border-primary/20 bg-surface2 shadow-[0_8px_30px_rgba(139,92,246,.18)]">
          <BrandIcon size={28} className="h-7 w-7 object-contain" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold tracking-tight">RARY Vizion</p>
          <p className="truncate text-xs text-muted">{user?.company.name}</p>
        </div>
        <button aria-label="Fechar menu" className="ml-auto rounded-lg p-2 text-muted md:hidden" onClick={() => setOpen(false)}>×</button>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain" aria-label="Principal">
        {NAV.map((item) => {
          if (item.admin && !isAdmin) return null;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={active ? 'page' : undefined}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${active ? 'bg-primary/15 text-white shadow-[inset_0_0_0_1px_rgba(139,92,246,.12)]' : 'text-muted hover:bg-white/[0.04] hover:text-fg'
                }`}
            >
              <span className={active ? 'text-primary' : 'text-muted group-hover:text-fg'}><Icon name={item.icon} /></span>
              <span className="flex-1">{item.label}</span>
              {item.soon && <span className="rounded-md border border-line px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted/70">soon</span>}
            </Link>
          );
        })}
      </nav>

      <div className="mt-3 shrink-0 border-t border-line/80 px-2 pt-3">
        <div className="mb-3 flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-surface2 text-xs font-semibold text-primary">
            {user?.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <p className="truncate text-xs text-muted">{user ? ROLE_LABEL[user.role] : ''}</p>
          </div>
        </div>
        <button onClick={logout} className="btn-ghost w-full">Sair</button>
      </div>
    </aside>
  );

  return (
    <>
      <header className="glass fixed inset-x-0 top-0 z-40 flex h-16 items-center border-x-0 border-t-0 px-4 md:hidden">
        <button
          aria-label="Abrir menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="rounded-xl border border-line p-2.5 text-muted"
        >
          ☰
        </button>
        <div className="ml-3 flex items-center gap-2 text-sm font-semibold">
          <BrandIcon size={24} className="h-6 w-6 object-contain" />
          RARY Vizion
        </div>
      </header>
      <div className="fixed inset-y-0 left-0 z-30 hidden md:block">{sidebar}</div>
      {open && (
        <div className="fixed inset-0 z-50 overflow-hidden md:hidden">
          <button
            aria-label="Fechar menu"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative h-dvh w-[260px] max-w-[calc(100vw_-_2rem)]">{sidebar}</div>
        </div>
      )}
    </>
  );
}
