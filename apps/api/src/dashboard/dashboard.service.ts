import { BadRequestException, Injectable } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { statusFromLastEntry } from '../time/time.rules';
import { DashboardPeriod } from './dashboard.dto';
import { summarizeWork } from './dashboard.metrics';

const DAY_MS = 86_400_000;

const PERIOD_DAYS: Record<DashboardPeriod, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

const ACTIVITY_DESCRIPTIONS: Record<string, string> = {
  'time.recorded': 'Registro de jornada efetuado',
  'user.created': 'Novo colaborador cadastrado',
  'department.created': 'Departamento criado',
  'company.registered': 'Empresa cadastrada',
};

function percentageChange(current: number, previous: number): number | null {
  return previous === 0 ? null : Math.round(((current - previous) / previous) * 1000) / 10;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(user: AuthUser, period: DashboardPeriod, departmentId?: string) {
    if (departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: departmentId, companyId: user.companyId },
        select: { id: true },
      });
      if (!department) throw new BadRequestException('Departamento inválido');
    }

    const now = new Date();
    const periodDays = PERIOD_DAYS[period];
    const utcToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const from = new Date(utcToday.getTime() - (periodDays - 1) * DAY_MS);
    const elapsedPeriodMs = now.getTime() - from.getTime();
    const previousFrom = new Date(from.getTime() - elapsedPeriodMs);

    const departmentConstraint = departmentId ? { departmentId } : {};
    const selectedDepartmentConstraint = departmentId ? { id: departmentId } : {};
    const timeEntryUserConstraint = departmentId
      ? { user: { companyId: user.companyId, departmentId } }
      : {};

    const [employees, previousEntries, periodEntries, currentHires, previousHires, departments, logs] =
      await Promise.all([
        this.prisma.user.findMany({
          where: { companyId: user.companyId, active: true, ...departmentConstraint },
          orderBy: { name: 'asc' },
          select: {
            id: true,
            createdAt: true,
            department: { select: { id: true, name: true } },
            timeEntries: {
              orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
              take: 1,
              select: { type: true },
            },
          },
        }),
        this.prisma.timeEntry.findMany({
          where: { companyId: user.companyId, recordedAt: { lt: previousFrom }, ...timeEntryUserConstraint },
          orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
          distinct: ['userId'],
          select: { id: true, userId: true, type: true, recordedAt: true },
        }),
        this.prisma.timeEntry.findMany({
          where: { companyId: user.companyId, recordedAt: { gte: previousFrom, lte: now }, ...timeEntryUserConstraint },
          orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }],
          select: { id: true, userId: true, type: true, recordedAt: true },
        }),
        this.prisma.user.count({
          where: { companyId: user.companyId, active: true, createdAt: { gte: from, lte: now }, ...departmentConstraint },
        }),
        this.prisma.user.count({
          where: { companyId: user.companyId, active: true, createdAt: { gte: previousFrom, lt: from }, ...departmentConstraint },
        }),
        this.prisma.department.findMany({
          where: { companyId: user.companyId, ...selectedDepartmentConstraint },
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        }),
        this.prisma.auditLog.findMany({
          where: { companyId: user.companyId, action: { not: 'auth.login' } },
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: { id: true, actorId: true, action: true, createdAt: true },
        }),
      ]);

    const work = summarizeWork(
      [...previousEntries, ...periodEntries],
      from,
      previousFrom,
      now,
      periodDays,
    );
    const statusCounts = { working: 0, onBreak: 0, offDuty: 0 };
    const departmentRows = new Map(
      departments.map((department) => [
        department.id,
        {
          id: department.id,
          name: department.name,
          employees: 0,
          working: 0,
          onBreak: 0,
          offDuty: 0,
          workedSeconds: 0,
        },
      ]),
    );

    for (const employee of employees) {
      const status = statusFromLastEntry(employee.timeEntries[0]?.type);
      const statusKey = status === 'WORKING' ? 'working' : status === 'ON_BREAK' ? 'onBreak' : 'offDuty';
      statusCounts[statusKey] += 1;

      const department = employee.department
        ? departmentRows.get(employee.department.id)
        : undefined;
      if (department) {
        department.employees += 1;
        department[statusKey] += 1;
        department.workedSeconds += work.employeeWorkedSeconds[employee.id] ?? 0;
      }
    }

    const actorIds = [...new Set(logs.flatMap((log) => (log.actorId ? [log.actorId] : [])))];
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { companyId: user.companyId, id: { in: actorIds } },
          select: { id: true, name: true },
        })
      : [];
    const actorNames = new Map(actors.map((actor) => [actor.id, actor.name]));

    return {
      generatedAt: now.toISOString(),
      period,
      workforce: {
        activeEmployees: employees.length,
        working: statusCounts.working,
        onBreak: statusCounts.onBreak,
        offDuty: statusCounts.offDuty,
        newEmployees: {
          current: currentHires,
          previous: previousHires,
          changePercent: percentageChange(currentHires, previousHires),
        },
        departments: [...departmentRows.values()],
      },
      attendance: {
        workedSeconds: work.workedSeconds,
        previousWorkedSeconds: work.previousWorkedSeconds,
        changePercent: percentageChange(work.workedSeconds, work.previousWorkedSeconds),
        averagePerActiveEmployeeSeconds:
          employees.length > 0 ? Math.floor(work.workedSeconds / employees.length) : 0,
        trend: work.trend,
      },
      activity: logs.map((log) => ({
        id: log.id,
        description: ACTIVITY_DESCRIPTIONS[log.action] ?? 'Atividade registrada',
        actorName: log.actorId ? actorNames.get(log.actorId) ?? null : null,
        createdAt: log.createdAt.toISOString(),
      })),
      availability: {
        projects: false,
        tasks: false,
        meetings: false,
        intelligence: false,
      },
    };
  }
}
