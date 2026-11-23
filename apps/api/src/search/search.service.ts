import { BadRequestException, Injectable } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { PermissionsService } from '../auth/permissions.service';
import { SupabaseDataService } from '../supabase/supabase.service';

export type SearchItem = { type: 'project' | 'task' | 'person' | 'meeting' | 'conversation' | 'event'; title: string; subtitle: string; href: string };

@Injectable()
export class SearchService {
  constructor(private readonly db: SupabaseDataService, private readonly permissions: PermissionsService) {}

  async search(user: AuthUser, rawQuery: string): Promise<{ results: SearchItem[] }> {
    const term = rawQuery?.trim();
    if (!term || term.length < 2 || term.length > 100) throw new BadRequestException('A busca deve ter entre 2 e 100 caracteres');
    const result: SearchItem[] = [];
    const allowed = async (module: Parameters<PermissionsService['isAllowed']>[1]) => this.permissions.isAllowed(user, module, 'view');
    const tasks: Promise<void>[] = [];

    if (await allowed('projects')) tasks.push((async () => {
      const projects = await this.db.project.findMany({ where: { companyId: user.companyId, name: { contains: term } }, orderBy: { updatedAt: 'desc' }, take: 8, select: { id: true, name: true, status: true } });
      result.push(...projects.map((item: any) => ({ type: 'project' as const, title: item.name, subtitle: `Projeto · ${item.status}`, href: `/projects?projectId=${item.id}` })));
      const projectIndex = await this.db.project.findMany({ where: { companyId: user.companyId }, orderBy: { updatedAt: 'desc' }, take: 500, select: { id: true, name: true } });
      const projectById = new Map(projectIndex.map((item: any) => [item.id, item.name]));
      const rows = projectIndex.length ? await this.db.projectTask.findMany({ where: { projectId: { in: projectIndex.map((item: any) => item.id) }, title: { contains: term } }, orderBy: { updatedAt: 'desc' }, take: 8, select: { id: true, title: true, projectId: true } }) : [];
      result.push(...rows.map((item: any) => ({ type: 'task' as const, title: item.title, subtitle: `Tarefa · ${projectById.get(item.projectId)}`, href: `/projects?projectId=${item.projectId}&taskId=${item.id}` })));
    })());
    if (await allowed('workforce')) tasks.push((async () => {
      const people = await this.db.user.findMany({ where: { companyId: user.companyId, active: true, OR: [{ name: { contains: term } }, { email: { contains: term } }, { jobTitle: { contains: term } }] }, orderBy: { name: 'asc' }, take: 8, select: { id: true, name: true, email: true, jobTitle: true } });
      result.push(...people.map((item: any) => ({ type: 'person' as const, title: item.name, subtitle: `Pessoa · ${item.jobTitle || item.email}`, href: `/workforce?personId=${item.id}` })));
    })());
    if (await allowed('meetings')) tasks.push((async () => {
      const rows = await this.db.meeting.findMany({ where: { companyId: user.companyId, name: { contains: term } }, orderBy: { startsAt: 'asc' }, take: 20, include: { participants: true } });
      result.push(...rows.filter((item: any) => item.accessMode !== 'PRIVATE' || item.createdById === user.id || item.participants.some((p: any) => p.userId === user.id)).slice(0, 8).map((item: any) => ({ type: 'meeting' as const, title: item.name, subtitle: `Reunião · ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.startsAt))}`, href: `/meetings?meetingId=${item.id}` })));
    })());
    if (await allowed('workspace')) tasks.push((async () => {
      const rows = await this.db.calendarEvent.findMany({ where: { companyId: user.companyId, title: { contains: term } }, orderBy: { startsAt: 'asc' }, take: 8, select: { id: true, title: true, category: true, accessMode: true, createdById: true, startsAt: true } });
      result.push(...rows.filter((item: any) => item.accessMode !== 'PRIVATE' || item.createdById === user.id).map((item: any) => ({ type: 'event' as const, title: item.title, subtitle: `Evento · ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.startsAt))}`, href: `/calendar?eventId=${item.id}&date=${encodeURIComponent(new Date(item.startsAt).toISOString())}` })));
    })());
    if (await allowed('chat')) tasks.push((async () => {
      const memberships = await this.db.conversationParticipant.findMany({ where: { userId: user.id }, select: { conversationId: true, conversation: { select: { companyId: true } } }, take: 500 });
      const conversationIdsInCompany = memberships.filter((item: any) => item.conversation?.companyId === user.companyId).map((item: any) => item.conversationId);
      const conversationIds = conversationIdsInCompany;
      if (!conversationIds.length) return;
      const rows = await this.db.chatMessage.findMany({ where: { conversationId: { in: conversationIds }, body: { contains: term } }, orderBy: { createdAt: 'desc' }, take: 8, include: { conversation: { select: { id: true, name: true, companyId: true } } } });
      result.push(...rows.filter((item: any) => item.conversation.companyId === user.companyId).map((item: any) => ({ type: 'conversation' as const, title: item.conversation.name || 'Conversa direta', subtitle: `Mensagem · ${item.body.slice(0, 80)}`, href: `/chat?conversationId=${item.conversation.id}` })));
    })());
    await Promise.all(tasks);
    return { results: result.slice(0, 32) };
  }
}
