import type { PresenceStatus } from '@/lib/types';

const STYLE: Record<PresenceStatus, { label: string; dot: string }> = {
  WORKING: { label: 'Em jornada', dot: 'bg-ok' },
  ON_BREAK: { label: 'Em pausa', dot: 'bg-warn' },
  OFFLINE: { label: 'Offline', dot: 'bg-muted' },
};

export function StatusBadge({ status }: { status: PresenceStatus }) {
  const { label, dot } = STYLE[status];
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted">
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
      {label}
    </span>
  );
}
