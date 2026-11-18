import { TimeEntryType } from '../common/domain-types';

export type PresenceStatus = 'OFFLINE' | 'WORKING' | 'ON_BREAK';

/** Máquina de estados da jornada: quais registros são válidos em cada estado. */
export const ALLOWED_TRANSITIONS: Record<PresenceStatus, readonly TimeEntryType[]> = {
  OFFLINE: ['CLOCK_IN'],
  WORKING: ['BREAK_START', 'CLOCK_OUT'],
  ON_BREAK: ['BREAK_END', 'CLOCK_OUT'],
};

export function statusFromLastEntry(type?: string | null): PresenceStatus {
  switch (type) {
    case 'CLOCK_IN':
    case 'BREAK_END':
      return 'WORKING';
    case 'BREAK_START':
      return 'ON_BREAK';
    default:
      return 'OFFLINE';
  }
}

export interface EntryLike {
  type: string;
  recordedAt: Date;
}

/** Soma o tempo trabalhado (exclui pausas). `entries` deve estar em ordem crescente. */
export function computeWorkedSeconds(entries: readonly EntryLike[], now: Date): number {
  let totalMs = 0;
  let openSince: Date | null = null;

  for (const entry of entries) {
    if (entry.type === 'CLOCK_IN' || entry.type === 'BREAK_END') {
      openSince ??= entry.recordedAt;
    } else if (openSince) {
      totalMs += entry.recordedAt.getTime() - openSince.getTime();
      openSince = null;
    }
  }
  if (openSince) totalMs += now.getTime() - openSince.getTime();

  return Math.max(0, Math.floor(totalMs / 1000));
}
