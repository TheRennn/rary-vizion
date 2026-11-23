import { BadRequestException, Injectable } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/auth-user';
import { SupabaseDataService } from '../supabase/supabase.service';
import { ClockDto, HistoryQueryDto } from './dto/time.dto';
import { computeWorkedSeconds, statusFromLastEntry } from './time.rules';

const HISTORY_LIMIT = 1000;
const DEFAULT_HISTORY_DAYS = 30;

@Injectable()
export class TimeService {
  constructor(private readonly db: SupabaseDataService, private readonly audit: AuditService) {}

  async clock(user: AuthUser, dto: ClockDto) {
    try {
      const entry = await this.db.recordTimeEntry(user.companyId, user.id, dto.type, dto.note?.trim() || null);
      const result = { entry, status: statusFromLastEntry(entry.type) };

      await this.audit.log({
        companyId: user.companyId,
        actorId: user.id,
        action: 'time.recorded',
        entity: 'TimeEntry',
        entityId: result.entry.id,
        metadata: { type: result.entry.type },
      });
      return result;
    } catch (e) {
      throw e;
    }
  }

  async today(user: AuthUser) {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const [entries, last] = await Promise.all([
      this.db.timeEntry.findMany({
        where: { userId: user.id, recordedAt: { gte: startOfDay } },
        orderBy: { recordedAt: 'asc' },
        select: { id: true, type: true, recordedAt: true, note: true },
      }),
      this.db.timeEntry.findFirst({
        where: { userId: user.id },
        orderBy: { recordedAt: 'desc' },
        select: { type: true, recordedAt: true },
      }),
    ]);

    return {
      status: statusFromLastEntry(last?.type),
      since: last?.recordedAt ?? null,
      workedSeconds: computeWorkedSeconds(entries, now),
      entries,
      serverTime: now.toISOString(),
    };
  }

  history(user: AuthUser, query: HistoryQueryDto) {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from ? new Date(query.from) : new Date(to.getTime() - DEFAULT_HISTORY_DAYS * 86_400_000);
    if (from > to) throw new BadRequestException('"from" deve ser anterior a "to"');

    return this.db.timeEntry.findMany({
      where: { userId: user.id, recordedAt: { gte: from, lte: to } },
      orderBy: { recordedAt: 'desc' },
      take: HISTORY_LIMIT,
      select: { id: true, type: true, recordedAt: true, note: true },
    });
  }

  /** Presença da equipe: último registro de cada usuário ativo da empresa. */
  async team(companyId: string) {
    const users = await this.db.user.findMany({
      where: { companyId, active: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        role: true,
        jobTitle: true,
        department: { select: { id: true, name: true } },
        timeEntries: { orderBy: { recordedAt: 'desc' }, take: 1, select: { type: true, recordedAt: true } },
      },
    });

    return users.map(({ timeEntries, ...u }) => ({
      ...u,
      status: statusFromLastEntry(timeEntries[0]?.type),
      since: timeEntries[0]?.recordedAt ?? null,
    }));
  }
}
