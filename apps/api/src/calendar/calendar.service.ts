import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { PermissionsService } from '../auth/permissions.service';
import { SupabaseDataService } from '../supabase/supabase.service';
import { recordActivity } from '../activity/activity-writer';

export type CalendarItem = { id: string; source: 'meeting' | 'task' | 'event'; title: string; description: string | null; start: string; end: string; category: string; accessMode?: string; href: string; canEdit: boolean };

@Injectable()
export class CalendarService {
  constructor(private readonly db: SupabaseDataService, private readonly permissions: PermissionsService) {}

  async list(user: AuthUser, fromRaw: string, toRaw: string) {
    const from = new Date(fromRaw); const to = new Date(toRaw);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from || to.getTime() - from.getTime() > 93 * 86400_000) throw new BadRequestException('Intervalo do calendário inválido (máximo de 93 dias)');
    const [meetingsAllowed, projectsAllowed] = await Promise.all([this.permissions.isAllowed(user, 'meetings', 'view'), this.permissions.isAllowed(user, 'projects', 'view')]);
    const tasks: Promise<CalendarItem[]>[] = [this.db.calendarEvent.findMany({ where: { companyId: user.companyId, startsAt: { gte: from, lt: to } }, orderBy: { startsAt: 'asc' }, take: 500 }).then((rows: any[]) => rows.filter((item) => item.accessMode !== 'PRIVATE' || item.createdById === user.id).map((item) => ({ id: item.id, source: 'event' as const, title: item.title, description: item.description, start: item.startsAt.toISOString(), end: item.endsAt.toISOString(), category: item.category, accessMode: item.accessMode, href: '/calendar', canEdit: item.createdById === user.id || ['OWNER', 'ADMIN', 'MANAGER'].includes(user.role) })))];
    if (meetingsAllowed) tasks.push(this.db.meeting.findMany({ where: { companyId: user.companyId, startsAt: { gte: from, lt: to } }, include: { participants: true }, orderBy: { startsAt: 'asc' }, take: 500 }).then((rows: any[]) => rows.filter((item) => item.accessMode !== 'PRIVATE' || item.createdById === user.id || item.participants.some((participant: any) => participant.userId === user.id)).map((item) => ({ id: item.id, source: 'meeting' as const, title: item.name, description: item.description, start: item.startsAt.toISOString(), end: new Date(item.startsAt.getTime() + item.durationMinutes * 60_000).toISOString(), category: 'MEETING', href: `/meetings?meetingId=${item.id}`, canEdit: item.createdById === user.id }))));
    if (projectsAllowed) tasks.push((async () => {
      const projects = await this.db.project.findMany({ where: { companyId: user.companyId }, orderBy: { updatedAt: 'desc' }, take: 500, select: { id: true, name: true } });
      const names = new Map(projects.map((item: any) => [item.id, item.name]));
      if (!projects.length) return [];
      const dueTasks = await this.db.projectTask.findMany({ where: { projectId: { in: projects.map((item: any) => item.id) }, dueAt: { gte: from, lt: to } }, orderBy: { dueAt: 'asc' }, take: 500, select: { id: true, title: true, dueAt: true, projectId: true, status: true } });
      return dueTasks.map((item: any) => ({ id: item.id, source: 'task' as const, title: item.title, description: `${names.get(item.projectId)} · ${item.status}`, start: item.dueAt.toISOString(), end: new Date(item.dueAt.getTime() + 60 * 60_000).toISOString(), category: 'TASK', href: `/projects?projectId=${item.projectId}&taskId=${item.id}`, canEdit: true }));
    })());
    return (await Promise.all(tasks)).flat().sort((a, b) => a.start.localeCompare(b.start));
  }

  async create(user: AuthUser, body: { title: string; description?: string; category?: string; accessMode?: string; startsAt: string; endsAt: string }) {
    const title = body.title?.trim(); const startsAt = new Date(body.startsAt); const endsAt = new Date(body.endsAt);
    if (!title || title.length > 200 || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) throw new BadRequestException('Título e intervalo de horário válidos são obrigatórios');
    if (endsAt.getTime() - startsAt.getTime() > 7 * 86400_000) throw new BadRequestException('Um evento não pode exceder sete dias');
    if (body.category && !['EVENT', 'COMMITMENT'].includes(body.category)) throw new BadRequestException('Categoria inválida');
    const event = await this.db.calendarEvent.create({ data: { companyId: user.companyId, createdById: user.id, title, description: body.description?.trim() || null, category: body.category ?? 'EVENT', accessMode: body.accessMode === 'PRIVATE' ? 'PRIVATE' : 'TEAM', startsAt, endsAt } });
    await recordActivity(this.db, user, { eventType: 'calendar.created', module: 'calendar', title: 'Evento criado', entityType: 'calendar_event', entityId: event.id, targetUserId: event.accessMode === 'PRIVATE' ? user.id : null, href: `/calendar?eventId=${event.id}` });
    return event;
  }

  async update(user: AuthUser, id: string, body: { title?: string; description?: string | null; category?: string; accessMode?: string; startsAt?: string; endsAt?: string }) {
    const event = await this.db.calendarEvent.findFirst({ where: { id, companyId: user.companyId } });
    if (!event) throw new NotFoundException('Evento não encontrado');
    if (event.createdById !== user.id && !['OWNER', 'ADMIN', 'MANAGER'].includes(user.role)) throw new ForbiddenException('Sem permissão para editar este evento');
    if (body.title !== undefined && (!body.title.trim() || body.title.trim().length > 200)) throw new BadRequestException('Título deve ter entre 1 e 200 caracteres');
    const startsAt = body.startsAt ? new Date(body.startsAt) : event.startsAt; const endsAt = body.endsAt ? new Date(body.endsAt) : event.endsAt;
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) throw new BadRequestException('Intervalo de horário inválido');
    if (endsAt.getTime() - startsAt.getTime() > 7 * 86400_000) throw new BadRequestException('Um evento não pode exceder sete dias');
    if (body.category && !['EVENT', 'COMMITMENT'].includes(body.category)) throw new BadRequestException('Categoria inválida');
    return this.db.calendarEvent.update({ where: { id }, data: { ...(body.title !== undefined ? { title: body.title.trim() } : {}), ...(body.description !== undefined ? { description: body.description?.trim() || null } : {}), ...(body.category !== undefined ? { category: body.category } : {}), ...(body.accessMode !== undefined ? { accessMode: body.accessMode === 'PRIVATE' ? 'PRIVATE' : 'TEAM' } : {}), ...(body.startsAt !== undefined ? { startsAt } : {}), ...(body.endsAt !== undefined ? { endsAt } : {}), updatedAt: new Date() } });
  }

  async remove(user: AuthUser, id: string) {
    const event = await this.db.calendarEvent.findFirst({ where: { id, companyId: user.companyId } });
    if (!event) throw new NotFoundException('Evento não encontrado');
    if (event.createdById !== user.id && !['OWNER', 'ADMIN', 'MANAGER'].includes(user.role)) throw new ForbiddenException('Sem permissão para excluir este evento');
    return this.db.calendarEvent.deleteMany({ where: { id, companyId: user.companyId } });
  }
}
