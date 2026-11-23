import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { SupabaseDataService } from '../supabase/supabase.service';

const widgets = ['time', 'tasks', 'projects', 'meetings', 'inbox', 'chat', 'focus', 'week'] as const;
const defaults = { order: [...widgets], hidden: [] as string[] };

@Injectable()
export class WorkspaceService {
  constructor(private readonly db: SupabaseDataService) {}

  async getPreferences(user: AuthUser) {
    const row = await this.db.workspacePreference.findFirst({ where: { userId: user.id, companyId: user.companyId }, select: { layout: true } });
    return row?.layout ?? defaults;
  }

  async savePreferences(user: AuthUser, layout: { order: string[]; hidden: string[] }) {
    if (!layout || !Array.isArray(layout.order) || !Array.isArray(layout.hidden) || [...layout.order, ...layout.hidden].some((item) => !widgets.includes(item as any))) throw new BadRequestException('Layout de widgets inválido');
    const order = [...new Set(layout.order)];
    const hidden = [...new Set(layout.hidden)].filter((item) => !order.includes(item));
    const normalized = { order: [...order, ...widgets.filter((item) => !order.includes(item))], hidden };
    return this.db.workspacePreference.upsert({ where: { userId: user.id }, create: { userId: user.id, companyId: user.companyId, layout: normalized }, update: { layout: normalized, updatedAt: new Date() } });
  }

  async focus(user: AuthUser) {
    const [active, history] = await Promise.all([
      this.db.focusSession.findFirst({ where: { userId: user.id, companyId: user.companyId, status: { in: ['RUNNING', 'PAUSED'] } } }),
      this.db.focusSession.findMany({ where: { userId: user.id, companyId: user.companyId }, orderBy: { startedAt: 'desc' }, take: 20, include: { task: { select: { id: true, title: true, projectId: true } } } }),
    ]);
    return { active, history };
  }

  async startFocus(user: AuthUser, taskId: string) {
    const task = await this.db.projectTask.findFirst({ where: { id: taskId }, select: { id: true, projectId: true } });
    const project = task && await this.db.project.findFirst({ where: { id: task.projectId, companyId: user.companyId }, select: { id: true } });
    if (!task || !project) throw new NotFoundException('Tarefa não encontrada');
    const active = await this.db.focusSession.findFirst({ where: { userId: user.id, companyId: user.companyId, status: { in: ['RUNNING', 'PAUSED'] } }, select: { id: true } });
    if (active) throw new ConflictException('Finalize ou pause sua sessão de foco atual antes de iniciar outra');
    try { return await this.db.focusSession.create({ data: { companyId: user.companyId, userId: user.id, taskId, status: 'RUNNING', startedAt: new Date(), pausedSeconds: 0 } }); }
    catch { throw new ConflictException('Já existe uma sessão de foco ativa'); }
  }

  private async activeFocus(user: AuthUser) {
    const session = await this.db.focusSession.findFirst({ where: { userId: user.id, companyId: user.companyId, status: { in: ['RUNNING', 'PAUSED'] } } });
    if (!session) throw new NotFoundException('Nenhuma sessão de foco ativa');
    return session;
  }

  async pauseFocus(user: AuthUser) {
    const session = await this.activeFocus(user);
    if (session.status !== 'RUNNING') throw new ConflictException('A sessão já está pausada');
    return this.db.focusSession.update({ where: { id: session.id }, data: { status: 'PAUSED', pausedAt: new Date() } });
  }

  async resumeFocus(user: AuthUser) {
    const session = await this.activeFocus(user);
    if (session.status !== 'PAUSED' || !session.pausedAt) throw new ConflictException('A sessão não está pausada');
    const pausedSeconds = session.pausedSeconds + Math.max(0, Math.floor((Date.now() - new Date(session.pausedAt).getTime()) / 1000));
    return this.db.focusSession.update({ where: { id: session.id }, data: { status: 'RUNNING', pausedAt: null, pausedSeconds } });
  }

  async finishFocus(user: AuthUser) {
    const session = await this.activeFocus(user);
    const pausedSeconds = session.pausedAt ? session.pausedSeconds + Math.max(0, Math.floor((Date.now() - new Date(session.pausedAt).getTime()) / 1000)) : session.pausedSeconds;
    return this.db.focusSession.update({ where: { id: session.id }, data: { status: 'COMPLETED', pausedAt: null, pausedSeconds, finishedAt: new Date() } });
  }
}
