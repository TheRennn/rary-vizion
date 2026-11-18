import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { ClockDto, HistoryQueryDto } from './dto/time.dto';
import { ALLOWED_TRANSITIONS, computeWorkedSeconds, statusFromLastEntry } from './time.rules';

const HISTORY_LIMIT = 1000;
const DEFAULT_HISTORY_DAYS = 30;

@Injectable()
export class TimeService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async clock(user: AuthUser, dto: ClockDto) {
    try {
      // Serializable evita dois registros simultâneos violarem a máquina de estados.
      const result = await this.prisma.$transaction(
        async (tx) => {
          const last = await tx.timeEntry.findFirst({
            where: { userId: user.id },
            orderBy: { recordedAt: 'desc' },
            select: { type: true },
          });
          const current = statusFromLastEntry(last?.type);

          if (!ALLOWED_TRANSITIONS[current].includes(dto.type)) {
            throw new BadRequestException(`Registro "${dto.type}" não é permitido no estado atual (${current})`);
          }

          const entry = await tx.timeEntry.create({
            data: { companyId: user.companyId, userId: user.id, type: dto.type, note: dto.note?.trim() || null },
          });
          return { entry, status: statusFromLastEntry(entry.type) };
        },
      );

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
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034') {
        throw new ConflictException('Conflito ao registrar o ponto, tente novamente');
      }
      throw e;
    }
  }

  async today(user: AuthUser) {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const [entries, last] = await Promise.all([
      this.prisma.timeEntry.findMany({
        where: { userId: user.id, recordedAt: { gte: startOfDay } },
        orderBy: { recordedAt: 'asc' },
        select: { id: true, type: true, recordedAt: true, note: true },
      }),
      this.prisma.timeEntry.findFirst({
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

    return this.prisma.timeEntry.findMany({
      where: { userId: user.id, recordedAt: { gte: from, lte: to } },
      orderBy: { recordedAt: 'desc' },
      take: HISTORY_LIMIT,
      select: { id: true, type: true, recordedAt: true, note: true },
    });
  }

  /** Presença da equipe: último registro de cada usuário ativo da empresa. */
  async team(companyId: string) {
    const users = await this.prisma.user.findMany({
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
