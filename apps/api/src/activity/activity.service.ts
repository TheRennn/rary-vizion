import { BadRequestException, Injectable } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { SupabaseDataService } from '../supabase/supabase.service';

const modules = ['projects', 'meetings', 'calendar', 'settings'] as const;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class ActivityService {
  constructor(private readonly db: SupabaseDataService) {}

  async list(user: AuthUser, query: { module?: string; from?: string; to?: string; projectId?: string; q?: string; cursor?: string }) {
    const from = query.from ? new Date(query.from) : null;
    const to = query.to ? new Date(query.to) : null;
    const term = query.q?.trim();
    if (query.module && !modules.includes(query.module as any)) throw new BadRequestException('Módulo de atividade inválido');
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime())) || (from && to && to <= from)) throw new BadRequestException('Período de atividade inválido');
    if (from && to && to.getTime() - from.getTime() > 366 * 86400_000) throw new BadRequestException('O período máximo é de 366 dias');
    if (term && term.length < 2) throw new BadRequestException('A busca deve ter ao menos 2 caracteres');
    if (term && term.length > 100) throw new BadRequestException('A busca excede 100 caracteres');
    if (query.projectId && !uuid.test(query.projectId)) throw new BadRequestException('Projeto inválido');
    if (query.cursor && !uuid.test(query.cursor)) throw new BadRequestException('Cursor inválido');

    const where = {
      companyId: user.companyId,
      OR: [{ targetUserId: null }, { targetUserId: user.id }],
      ...(query.module ? { module: query.module } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(term ? { title: { contains: term } } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
    };
    const rows = await this.db.activityEvent.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(query.cursor ? { cursor: { id: query.cursor } } : {}),
      take: 21,
      select: { id: true, actorId: true, eventType: true, module: true, title: true, entityType: true, entityId: true, projectId: true, href: true, createdAt: true, actor: { select: { name: true } } },
    });
    return { items: rows.slice(0, 20), nextCursor: rows.length > 20 ? rows[19].id : null };
  }
}
