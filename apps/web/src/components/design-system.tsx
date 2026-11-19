import type { ReactNode } from 'react';

export function PageHeading({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return <div className="page-heading"><div className="min-w-0">{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1 className="mt-1">{title}</h1>{description && <p className="mt-1 text-xs text-muted">{description}</p>}</div>{actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}</div>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-state-mark">·</span><p className="text-xs font-medium text-fg">{title}</p><p className="mt-1 max-w-sm text-[11px] leading-5 text-muted">{description}</p>{action && <div className="mt-3">{action}</div>}</div>;
}

export function StatusIndicator({ label, tone = 'neutral' }: { label: string; tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }) {
  return <span className={`status-indicator status-${tone}`}><span aria-hidden="true" />{label}</span>;
}

export function PriorityIndicator({ priority }: { priority: 'low' | 'medium' | 'high' | 'urgent' }) {
  const labels = { low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente' };
  return <span className={`priority-indicator priority-${priority}`}><span aria-hidden="true">{priority === 'urgent' ? '↑↑' : priority === 'high' ? '↑' : priority === 'medium' ? '↗' : '↓'}</span>{labels[priority]}</span>;
}

export function CompactList({ children, label }: { children: ReactNode; label?: string }) {
  return <ul className="compact-list" aria-label={label}>{children}</ul>;
}

export function ActivityFeed({ children, label = 'Atividade recente' }: { children: ReactNode; label?: string }) {
  return <ol className="activity-feed" aria-label={label}>{children}</ol>;
}

export function ActivityItem({ children }: { children: ReactNode }) {
  return <li className="activity-item"><span className="activity-dot" aria-hidden="true" /><div className="min-w-0 flex-1">{children}</div></li>;
}

export function FilterBar({ children, label }: { children: ReactNode; label: string }) {
  return <section className="filter-bar" aria-label={label}>{children}</section>;
}

export function DataTable<T extends { id: string }>({ columns, rows, rowLabel }: { columns: { key: string; label: string; render: (row: T) => ReactNode; className?: string }[]; rows: T[]; rowLabel: (row: T) => string }) {
  return <div className="data-table-scroll"><table className="data-table"><thead><tr>{columns.map((column) => <th key={column.key} className={column.className}>{column.label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id} aria-label={rowLabel(row)}>{columns.map((column) => <td key={column.key} className={column.className}>{column.render(row)}</td>)}</tr>)}</tbody></table></div>;
}

export function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  return <span className={`avatar avatar-${size}`} aria-label={name}>{initials || '?'}</span>;
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`skeleton ${className}`} aria-hidden="true" />;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div role="alert" className="error-state"><span>{message}</span>{onRetry && <button className="btn-ghost" onClick={onRetry}>Tentar novamente</button>}</div>;
}

export function ContextMenu({ children, label = 'Mais ações' }: { children: ReactNode; label?: string }) {
  return <details className="context-menu"><summary aria-label={label}>•••</summary><div className="context-menu-popover">{children}</div></details>;
}
