'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './auth-provider';
import { ROLE_LABEL } from '@/lib/roles';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/time', label: 'Vizion Time' },
  { href: '/workforce', label: 'Workforce' },
  { href: '/chat', label: 'Chat', soon: true },
  { href: '/voice', label: 'Voice', soon: true },
  { href: '/meetings', label: 'Meetings', soon: true },
  { href: '/monitor', label: 'Monitor', soon: true },
  { href: '/projects', label: 'Projects', soon: true },
  { href: '/intelligence', label: 'Intelligence', soon: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="glass sticky top-0 flex h-screen w-60 shrink-0 flex-col border-y-0 border-l-0 p-4">
      <div className="mb-6 px-2">
        <p className="text-lg font-semibold">RARY Vizion</p>
        <p className="truncate text-xs text-muted">{user?.company.name}</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1" aria-label="Principal">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
                active ? 'bg-primary/15 text-fg' : 'text-muted hover:bg-surface2 hover:text-fg'
              }`}
            >
              {item.label}
              {item.soon && <span className="text-xs text-muted/70">em breve</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line pt-3">
        <p className="truncate text-sm">{user?.name}</p>
        <p className="mb-2 text-xs text-muted">{user ? ROLE_LABEL[user.role] : ''}</p>
        <button onClick={logout} className="btn-ghost w-full">
          Sair
        </button>
      </div>
    </aside>
  );
}
