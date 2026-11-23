'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { BrandIcon } from '@/components/brand-icon';
import { useAuth } from '@/components/auth-provider';
import { ROLE_LABEL } from '@/lib/roles';
import { ContextPanel, openContextPanel } from '@/components/context-panel';
import { api } from '@/lib/api';

type NavItem = { href: string; label: string; icon: string; module?: string; admin?: boolean; ownerOnly?: boolean; soon?: boolean };
const GROUPS: { label: string; items: NavItem[] }[] = [
  { label: 'Espaço de trabalho', items: [
    { href: '/dashboard', label: 'Painel', icon: 'grid', module: 'dashboard' },
    { href: '/activity', label: 'Atividades', icon: 'activity', module: 'dashboard' },
    { href: '/calendar', label: 'Calendário', icon: 'calendar', module: 'workspace' },
    { href: '/inbox', label: 'Caixa de entrada', icon: 'inbox', module: 'inbox' },
    { href: '/workspace', label: 'Meu espaço de trabalho', icon: 'home', module: 'workspace' },
  ] },
  { label: 'Organização', items: [
    { href: '/workforce', label: 'Equipe', icon: 'users', module: 'workforce' },
    { href: '/time', label: 'Jornada', icon: 'clock', module: 'time' },
    { href: '/projects', label: 'Projetos', icon: 'folder', module: 'projects' },
    { href: '/chat', label: 'Chat', icon: 'chat', module: 'chat' },
    { href: '/voice', label: 'Voz', icon: 'mic', module: 'voice', soon: true },
    { href: '/meetings', label: 'Reuniões', icon: 'video', module: 'meetings' },
    { href: '/monitor', label: 'Monitoramento', icon: 'activity', module: 'monitor', soon: true },
    { href: '/intelligence', label: 'Inteligência', icon: 'spark', module: 'intelligence', soon: true },
    { href: '/documents', label: 'Documentos', icon: 'file', module: 'documents', soon: true },
    { href: '/reports', label: 'Relatórios', icon: 'chart', module: 'reports' },
    { href: '/automations', label: 'Automações', icon: 'bolt', module: 'automations', soon: true },
  ] },
  { label: 'Administração', items: [
    { href: '/audit', label: 'Auditoria', icon: 'shield', module: 'audit', admin: true },
    { href: '/settings', label: 'Configurações', icon: 'settings', module: 'settings' },
    { href: '/settings/permissions', label: 'Permissões', icon: 'shield', module: 'settings', ownerOnly: true },
  ] },
];

const ROUTE_NAMES: Record<string, string> = Object.fromEntries(GROUPS.flatMap((group) => group.items.map((item) => [item.href, item.label])));

function Icon({ name, className = 'h-4 w-4' }: { name: string; className?: string }) {
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    inbox: <><path d="M4 4h16v16H4z" /><path d="M4 13h4l2 3h4l2-3h4" /></>, home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v12h14V9M9 21v-7h6v7" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    chat: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /><path d="M8 9h8M8 13h5" /></>,
    mic: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" /></>,
    video: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3z" /></>,
    activity: <path d="M3 12h4l2-7 4 14 2-7h6" />,
    folder: <path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
    spark: <><path d="m12 3-1.8 5.2L5 10l5.2 1.8L12 17l1.8-5.2L19 10l-5.2-1.8z" /><path d="M19 17l-.7 2.3L16 20l2.3.7L19 23l.7-2.3L22 20l-2.3-.7z" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>,
    chart: <><path d="M4 19V5M4 19h17" /><path d="m7 15 4-4 3 2 5-6" /></>,
    bolt: <path d="m13 2-3 9h7l-6 11 2-9H6z" />,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.5.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.5-.9l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.8l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.5-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.5.9l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 1.8Z" transform="translate(-1 -1)" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /><path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" /></>,
    check: <><path d="m5 12 4 4L19 6" /><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z" />,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    panel: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>{paths[name] ?? paths.grid}</svg>;
}

type Command = { label: string; hint: string; href?: string; action?: () => void; icon: string };
type SearchResult = { type: string; title: string; subtitle: string; href: string };

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, can, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [favorites, setFavorites] = useState<string[]>(['/dashboard', '/workforce']);
  const [favoriteReady, setFavoriteReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const isAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const isOwner = user?.role === 'OWNER' || user?.role === 'SUPER_ADMIN';
  const currentLabel = ROUTE_NAMES[pathname] ?? (pathname.startsWith('/projects/') ? 'Projetos' : 'RARY Vizion');

  useEffect(() => {
    setCollapsed(localStorage.getItem('vizion.sidebar.collapsed') === 'true');
    const savedFavorites = localStorage.getItem('vizion.sidebar.favorites');
    if (savedFavorites) {
      try { setFavorites(JSON.parse(savedFavorites) as string[]); } catch { /* usa os favoritos padrão */ }
    }
    setFavoriteReady(true);
  }, []);

  useEffect(() => {
    if (!favoriteReady) return;
    localStorage.setItem('vizion.sidebar.favorites', JSON.stringify(favorites));
  }, [favoriteReady, favorites]);

  useEffect(() => {
    if (commandOpen) requestAnimationFrame(() => inputRef.current?.focus());
    else { setQuery(''); setActiveIndex(0); }
  }, [commandOpen]);

  useEffect(() => {
    if (!commandOpen || query.trim().length < 2) { setSearchResults([]); setSearchLoading(false); return; }
    let active = true;
    const timer = setTimeout(() => {
      setSearchLoading(true);
      void api<{ results: SearchResult[] }>(`/search?q=${encodeURIComponent(query.trim())}`).then((value) => { if (active) setSearchResults(value.results); }).catch(() => { if (active) setSearchResults([]); }).finally(() => { if (active) setSearchLoading(false); });
    }, 180);
    return () => { active = false; clearTimeout(timer); };
  }, [commandOpen, query]);

  useEffect(() => {
    if (!user || !can('inbox', 'view')) { setUnreadCount(0); return; }
    let active = true;
    const refresh = () => void api<Array<{ readAt: string | null }>>('/notifications').then((items) => {
      if (active) setUnreadCount(items.filter((item) => !item.readAt).length);
    }).catch(() => { if (active) setUnreadCount(0); });
    refresh();
    const timer = setInterval(refresh, 60_000);
    return () => { active = false; clearInterval(timer); };
  }, [user, can]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
      if (event.key === 'Escape') { setCommandOpen(false); setMobileOpen(false); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const commands: Command[] = useMemo(() => [
    ...GROUPS.flatMap((group) => group.items.filter((item) => (!item.admin || isAdmin) && (!item.ownerOnly || isOwner) && (!item.module || can(item.module, 'view'))).map((item) => ({ label: item.label, hint: 'Navegar', href: item.href, icon: item.icon }))),
    { label: 'Abrir jornada', hint: 'Ir para o registro de jornada', href: '/time', icon: 'clock' },
    { label: 'Abrir equipe', hint: 'Ir para a gestão de pessoas', href: '/workforce', icon: 'plus' },
    { label: 'Informações do espaço de trabalho', hint: 'Abrir painel contextual', action: () => user && openContextPanel({ title: user.company.name, eyebrow: 'Espaço de trabalho', description: 'Espaço da organização no RARY Vizion.', fields: [['Plano', 'Ambiente de demonstração'], ['Seu papel', ROLE_LABEL[user.role]], ['Conta', user.email]] }), icon: 'panel' },
    ...searchResults.map((item) => ({ label: item.title, hint: item.subtitle, href: item.href, icon: ({ project: 'folder', task: 'check', person: 'users', meeting: 'video', conversation: 'chat', event: 'calendar' } as Record<string, string>)[item.type] ?? 'search' })),
  ], [isAdmin, isOwner, can, searchResults, user]);
  const filteredCommands = commands.filter((command) => `${command.label} ${command.hint}`.toLowerCase().includes(query.toLowerCase()));

  function navigate(command?: Command) {
    if (!command) return;
    setCommandOpen(false);
    if (command.href) router.push(command.href);
    else command.action?.();
  }

  function onCommandKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, filteredCommands.length - 1)); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); }
    if (event.key === 'Enter') { event.preventDefault(); navigate(filteredCommands[activeIndex]); }
  }

  function toggleCollapsed() {
    setCollapsed((current) => {
      localStorage.setItem('vizion.sidebar.collapsed', String(!current));
      return !current;
    });
  }

  function toggleFavorite(href: string) {
    setFavorites((current) => current.includes(href) ? current.filter((favorite) => favorite !== href) : [...current, href]);
  }

  const sidebar = (
    <aside className={`app-sidebar ${collapsed ? 'app-sidebar-collapsed' : ''}`}>
      <div className="sidebar-topline">
        <Link href="/dashboard" className="brand-link" aria-label="RARY Vizion — dashboard">
          <span className="brand-mark"><BrandIcon size={22} className="h-[22px] w-[22px] object-contain" /></span>
          {!collapsed && <span className="min-w-0"><span className="block text-[15px] font-semibold leading-tight text-fg">RARY Vizion</span><span className="mt-1 block truncate text-[11px] text-muted">{user?.company.name}</span></span>}
        </Link>
        {!collapsed && <button className="icon-button ml-auto" title="Ações rápidas" aria-label="Ações rápidas" onClick={() => setCommandOpen(true)}><Icon name="plus" /></button>}
      </div>

      {!collapsed && (
        <button className="workspace-switcher" onClick={() => user && openContextPanel({ title: user.company.name, eyebrow: 'Espaço de trabalho atual', description: 'Informações da organização e da sua conta.', fields: [['Membro', user.name], ['Papel', ROLE_LABEL[user.role]], ['E-mail', user.email]] })}>
          <span className="workspace-dot">{user?.company.name?.slice(0, 1).toUpperCase() || 'R'}</span><span className="truncate">{user?.company.name}</span><span className="ml-auto text-muted">⌄</span>
        </button>
      )}
      {collapsed && <button className="workspace-dot mx-auto my-2" title={user?.company.name} onClick={() => user && openContextPanel({ title: user.company.name, eyebrow: 'Espaço de trabalho' })}>{user?.company.name?.slice(0, 1).toUpperCase() || 'R'}</button>}

      <button className="sidebar-search" title="Pesquisar (Ctrl K)" onClick={() => setCommandOpen(true)}><Icon name="search" /><span>{collapsed ? '' : 'Pesquisar'}</span>{!collapsed && <kbd>Ctrl K</kbd>}</button>
      <nav className="sidebar-navigation" aria-label="Navegação principal">
        {favorites.length > 0 && <div className="nav-group"><div className="nav-group-title">{!collapsed && 'Favoritos'}</div>{GROUPS.flatMap((group) => group.items).filter((item) => favorites.includes(item.href) && (!item.admin || isAdmin) && (!item.ownerOnly || isOwner) && (!item.module || can(item.module, 'view'))).map((item) => <NavLink key={`fav-${item.href}`} item={item} collapsed={collapsed} active={pathname === item.href} onToggleFavorite={toggleFavorite} favorite unreadCount={item.href === '/inbox' ? unreadCount : 0} onNavigate={() => setMobileOpen(false)} />)}</div>}
        {GROUPS.map((group) => {
          const items = group.items.filter((item) => (!item.admin || isAdmin) && (!item.ownerOnly || isOwner) && (!item.module || can(item.module, 'view')));
          return <div key={group.label} className="nav-group"><div className="nav-group-title">{!collapsed && group.label}</div>{items.map((item) => <NavLink key={item.href} item={item} collapsed={collapsed} active={pathname === item.href} onToggleFavorite={toggleFavorite} favorite={favorites.includes(item.href)} unreadCount={item.href === '/inbox' ? unreadCount : 0} onNavigate={() => setMobileOpen(false)} />)}</div>;
        })}
      </nav>

      <div className="sidebar-bottom">
        <button className="sidebar-collapse" onClick={toggleCollapsed} title={collapsed ? 'Expandir navegação' : 'Recolher navegação'}><span className={collapsed ? 'rotate-180' : ''}><Icon name="panel" /></span>{!collapsed && <span>Recolher menu</span>}</button>
        <button className="profile-row" onClick={() => user && openContextPanel({ title: user.name, eyebrow: 'Seu perfil', description: 'Sessão atual do espaço de trabalho.', fields: [['E-mail', user.email], ['Função', ROLE_LABEL[user.role]], ['Organização', user.company.name]], actions: [{ label: 'Sair da conta', onClick: logout }] })}>
          <span className="avatar-small">{user?.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>{!collapsed && <span className="min-w-0 flex-1 text-left"><span className="block truncate text-xs font-medium">{user?.name}</span><span className="block truncate text-[10px] text-muted">{user ? ROLE_LABEL[user.role] : ''}</span></span>}<span className="profile-more">•••</span>
        </button>
      </div>
    </aside>
  );

  return (
    <div className={`app-shell ${collapsed ? 'app-shell-collapsed' : ''}`}>
      <div className="hidden md:block">{sidebar}</div>
      <header className="app-topbar">
        <button className="mobile-menu-button md:hidden" aria-label="Abrir navegação" onClick={() => { setCollapsed(false); localStorage.setItem('vizion.sidebar.collapsed', 'false'); setMobileOpen(true); }}>☰</button>
        <div className="topbar-breadcrumb"><span className="text-muted">RARY Vizion</span><Icon name="chevron" className="h-3 w-3 text-muted/60" /><span>{currentLabel}</span></div>
        <div className="ml-auto flex items-center gap-1.5">
          <button className="topbar-search" onClick={() => setCommandOpen(true)} aria-label="Pesquisar no espaço de trabalho"><Icon name="search" /><span>Pesquisar</span><kbd>Ctrl K</kbd></button>
          <button className="icon-button notification-button" aria-label={unreadCount ? `Notificações, ${unreadCount} não lidas` : 'Notificações'} title={unreadCount ? `${unreadCount} não lidas` : 'Notificações'} onClick={() => router.push('/inbox')}><Icon name="bell" />{unreadCount > 0 && <span className="notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}</button>
          <button className="avatar-small topbar-avatar" aria-label="Abrir perfil" onClick={() => user && openContextPanel({ title: user.name, eyebrow: 'Seu perfil', fields: [['E-mail', user.email], ['Papel', ROLE_LABEL[user.role]]] })}>{user?.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</button>
        </div>
      </header>
      <main className="app-main"><div className="app-content">{children}</div></main>

      {mobileOpen && <div className="mobile-nav-overlay md:hidden"><button className="mobile-nav-backdrop" aria-label="Fechar navegação" onClick={() => setMobileOpen(false)} />{sidebar}</div>}

      {commandOpen && <div className="command-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCommandOpen(false); }}>
        <section className="command-dialog" role="dialog" aria-modal="true" aria-label="Menu de comandos">
          <div className="command-input-wrap"><Icon name="search" className="h-4 w-4 shrink-0 text-muted" /><input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }} onKeyDown={onCommandKeyDown} placeholder="Ir para… ou pesquisar uma ação" aria-label="Pesquisar comandos" /><kbd>ESC</kbd></div>
          <div className="command-results" role="listbox">{filteredCommands.map((command, index) => <button key={`${command.label}-${command.hint}`} role="option" aria-selected={activeIndex === index} className={`command-option ${activeIndex === index ? 'command-option-active' : ''}`} onMouseEnter={() => setActiveIndex(index)} onClick={() => navigate(command)}><span className="command-icon"><Icon name={command.icon} /></span><span className="flex-1 text-left">{command.label}</span><span className="text-xs text-muted">{command.hint}</span></button>)}{searchLoading && <div className="px-4 py-3 text-center text-xs text-muted" role="status">Pesquisando recursos…</div>}{filteredCommands.length === 0 && !searchLoading && <div className="px-4 py-8 text-center text-sm text-muted">Nenhum resultado para “{query}”.</div>}</div>
          <div className="command-footer"><span>↑↓ navegar</span><span>↵ abrir</span><span>Esc fechar</span></div>
        </section>
      </div>}
      <ContextPanel />
    </div>
  );
}

function NavLink({ item, collapsed, active, favorite, unreadCount = 0, onToggleFavorite, onNavigate }: { item: NavItem; collapsed: boolean; active: boolean; favorite: boolean; unreadCount?: number; onToggleFavorite: (href: string) => void; onNavigate: () => void }) {
  return <div className={`nav-link-wrap ${active ? 'is-active' : ''}`}>
    <Link href={item.href} onClick={onNavigate} title={collapsed ? `${item.label}${unreadCount ? ` · ${unreadCount} não lidas` : ''}` : undefined} aria-current={active ? 'page' : undefined} className="sidebar-link"><Icon name={item.icon} /><span className="nav-link-label">{item.label}</span>{unreadCount > 0 && <span className="nav-unread-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}{item.soon && !collapsed && <span className="sidebar-soon">em breve</span>}</Link>
    {!collapsed && !item.soon && <button className={`favorite-toggle ${favorite ? 'is-favorite' : ''}`} aria-label={favorite ? `Remover ${item.label} dos favoritos` : `Favoritar ${item.label}`} title={favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'} onClick={() => onToggleFavorite(item.href)}><Icon name="star" className="h-3 w-3" /></button>}
  </div>;
}
