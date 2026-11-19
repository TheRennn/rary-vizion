const DAY_MS = 86_400_000;

export interface DashboardTimeEntry {
  id: string;
  userId: string;
  type: string;
  recordedAt: Date;
}

export interface DashboardTrendPoint {
  from: string;
  starts: number;
  ends: number;
  workedSeconds: number;
}

export interface WorkSummary {
  workedSeconds: number;
  previousWorkedSeconds: number;
  employeeWorkedSeconds: Record<string, number>;
  trend: DashboardTrendPoint[];
}

export function summarizeWork(
  entries: readonly DashboardTimeEntry[],
  from: Date,
  previousFrom: Date,
  now: Date,
  periodDays: number,
): WorkSummary {
  const bucketDays = periodDays === 90 ? 7 : 1;
  const bucketMs = bucketDays * DAY_MS;
  const bucketCount = Math.ceil(periodDays / bucketDays);
  const bucketMilliseconds = Array.from({ length: bucketCount }, () => 0);
  const trend = Array.from({ length: bucketCount }, (_, index) => ({
    from: new Date(from.getTime() + index * bucketMs).toISOString(),
    starts: 0,
    ends: 0,
    workedSeconds: 0,
  }));
  const byUser = new Map<string, DashboardTimeEntry[]>();

  for (const entry of entries) {
    const userEntries = byUser.get(entry.userId) ?? [];
    userEntries.push(entry);
    byUser.set(entry.userId, userEntries);

    if (entry.recordedAt < from || entry.recordedAt > now) continue;
    const bucketIndex = Math.floor((entry.recordedAt.getTime() - from.getTime()) / bucketMs);
    if (!trend[bucketIndex]) continue;
    if (entry.type === 'CLOCK_IN') trend[bucketIndex].starts += 1;
    if (entry.type === 'CLOCK_OUT') trend[bucketIndex].ends += 1;
  }

  let currentMilliseconds = 0;
  let previousMilliseconds = 0;
  const employeeMilliseconds = new Map<string, number>();

  const addInterval = (userId: string, start: Date, end: Date) => {
    const intervalStart = Math.max(start.getTime(), previousFrom.getTime());
    const intervalEnd = Math.min(end.getTime(), now.getTime());
    if (intervalStart >= intervalEnd) return;

    const previousEnd = Math.min(intervalEnd, from.getTime());
    if (intervalStart < previousEnd) {
      previousMilliseconds += previousEnd - intervalStart;
    }

    let cursor = Math.max(intervalStart, from.getTime());
    if (cursor >= intervalEnd) return;
    const duration = intervalEnd - cursor;
    currentMilliseconds += duration;
    employeeMilliseconds.set(userId, (employeeMilliseconds.get(userId) ?? 0) + duration);

    let bucketIndex = Math.floor((cursor - from.getTime()) / bucketMs);
    while (cursor < intervalEnd && trend[bucketIndex]) {
      const bucketEnd = Math.min(intervalEnd, from.getTime() + (bucketIndex + 1) * bucketMs);
      if (bucketEnd <= cursor) break;
      bucketMilliseconds[bucketIndex] += bucketEnd - cursor;
      cursor = bucketEnd;
      bucketIndex += 1;
    }
  };

  for (const [userId, userEntries] of byUser) {
    userEntries.sort(
      (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime() || a.id.localeCompare(b.id),
    );
    let workStartedAt: Date | null = null;
    for (const entry of userEntries) {
      if (entry.type === 'CLOCK_IN' || entry.type === 'BREAK_END') {
        workStartedAt ??= entry.recordedAt;
      } else if ((entry.type === 'BREAK_START' || entry.type === 'CLOCK_OUT') && workStartedAt) {
        addInterval(userId, workStartedAt, entry.recordedAt);
        workStartedAt = null;
      }
    }
    if (workStartedAt) addInterval(userId, workStartedAt, now);
  }

  for (let index = 0; index < trend.length; index += 1) {
    trend[index].workedSeconds = Math.floor(bucketMilliseconds[index] / 1000);
  }

  return {
    workedSeconds: Math.floor(currentMilliseconds / 1000),
    previousWorkedSeconds: Math.floor(previousMilliseconds / 1000),
    employeeWorkedSeconds: Object.fromEntries(
      [...employeeMilliseconds].map(([userId, milliseconds]) => [
        userId,
        Math.floor(milliseconds / 1000),
      ]),
    ),
    trend,
  };
}
