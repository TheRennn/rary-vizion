import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { SupabaseDataService } from '../supabase/supabase.service';
import { recordActivity } from '../activity/activity-writer';

@Injectable()
export class ProjectsService {
  constructor(private readonly db: SupabaseDataService) {}

  private async assertCompanyUser(companyId: string, userId: string | null | undefined, label: string) {
    if (!userId) return;
    const user = await this.db.user.findFirst({ where: { id: userId, companyId, active: true }, select: { id: true } });
    if (!user) throw new BadRequestException(`${label} não pertence à empresa ativa`);
  }

  async list(user: AuthUser) {
    return this.db.project.findMany({
      where: { companyId: user.companyId },
      include: { tasks: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(user: AuthUser, body: { name: string; description?: string; dueAt?: string; ownerId?: string }) {
    const name = body.name?.trim();
    if (!name) throw new BadRequestException('Informe o nome do projeto');
    await this.assertCompanyUser(user.companyId, body.ownerId || user.id, 'Responsável');
    const project = await this.db.project.create({
      data: { companyId: user.companyId, name, description: body.description?.trim() || null, dueAt: body.dueAt ? new Date(body.dueAt) : null, ownerId: body.ownerId || user.id },
      include: { tasks: true },
    });
    await recordActivity(this.db, user, { eventType: 'project.created', module: 'projects', title: 'Projeto criado', entityType: 'project', entityId: project.id, href: `/projects?projectId=${project.id}` });
    return project;
  }

  async get(user: AuthUser, id: string) {
    const project = await this.db.project.findFirst({ where: { id, companyId: user.companyId }, include: { tasks: true } });
    if (!project) throw new NotFoundException('Projeto não encontrado');
    return project;
  }

  async projectDependencies(user: AuthUser, projectId: string) {
    const project = await this.get(user, projectId);
    const taskIds = project.tasks.map((task: { id: string }) => task.id);
    if (!taskIds.length) return [];
    return this.db.projectTaskDependency.findMany({ where: { taskId: { in: taskIds } }, orderBy: { createdAt: 'asc' }, take: 2000 });
  }

  async update(user: AuthUser, id: string, body: { name?: string; description?: string; status?: string; dueAt?: string | null; ownerId?: string | null }) {
    await this.get(user, id);
    await this.assertCompanyUser(user.companyId, body.ownerId, 'Responsável');
    if (body.status && !['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'].includes(body.status)) throw new BadRequestException('Status inválido');
    return this.db.project.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.description !== undefined ? { description: body.description.trim() || null } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.dueAt !== undefined ? { dueAt: body.dueAt ? new Date(body.dueAt) : null } : {}),
        ...(body.ownerId !== undefined ? { ownerId: body.ownerId } : {}),
      },
      include: { tasks: true },
    });
  }

  async createTask(user: AuthUser, projectId: string, body: { title: string; description?: string; status?: string; priority?: string; assigneeId?: string; startsAt?: string; dueAt?: string; isMilestone?: boolean; parentTaskId?: string; labels?: string[] }) {
    await this.get(user, projectId);
    if (!body || typeof body.title !== 'string') throw new BadRequestException('Informe o título da tarefa');
    await this.assertCompanyUser(user.companyId, body.assigneeId, 'Responsável');
    if (body.parentTaskId) {
      const parent = await this.db.projectTask.findFirst({ where: { id: body.parentTaskId, projectId }, select: { id: true } });
      if (!parent) throw new BadRequestException('A tarefa pai deve pertencer ao mesmo projeto');
    }
    const title = body.title.trim();
    if (!title || title.length > 200) throw new BadRequestException('O título deve ter entre 1 e 200 caracteres');
    if (body.status && !['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'].includes(body.status)) throw new BadRequestException('Status inválido');
    if (body.priority && !['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(body.priority)) throw new BadRequestException('Prioridade inválida');
    const startsAt = body.startsAt ? new Date(body.startsAt) : null;
    const dueAt = body.dueAt ? new Date(body.dueAt) : null;
    if (startsAt && Number.isNaN(startsAt.getTime())) throw new BadRequestException('Data de início inválida');
    if (dueAt && Number.isNaN(dueAt.getTime())) throw new BadRequestException('Prazo inválido');
    if (startsAt && dueAt && startsAt > dueAt) throw new BadRequestException('A data de início deve ser anterior ao prazo');
    if (body.isMilestone !== undefined && typeof body.isMilestone !== 'boolean') throw new BadRequestException('Marco inválido');
    const labels = body.labels ?? [];
    if (!Array.isArray(labels) || labels.length > 12 || labels.some((label) => typeof label !== 'string' || label.trim().length > 40)) throw new BadRequestException('Use até 12 etiquetas com no máximo 40 caracteres');
    const task = await this.db.projectTask.create({
      data: {
        projectId,
        title,
        description: body.description?.trim() || null,
        status: body.status ?? 'TODO',
        priority: body.priority ?? 'MEDIUM',
        assigneeId: body.assigneeId || null,
        startsAt,
        dueAt,
        completedAt: body.status === 'DONE' ? new Date() : null,
        isMilestone: body.isMilestone ?? false,
        parentTaskId: body.parentTaskId || null,
        labels: [...new Set(labels.map((label) => label.trim()).filter(Boolean))],
        createdById: user.id,
      },
    });
    if (body.assigneeId) await recordActivity(this.db, user, { eventType: 'task.assigned', module: 'projects', title: 'Tarefa atribuída', entityType: 'task', entityId: task.id, projectId, href: `/projects?projectId=${projectId}&taskId=${task.id}` });
    return task;
  }

  async updateTask(user: AuthUser, projectId: string, taskId: string, body: { title?: string; description?: string; status?: string; priority?: string; assigneeId?: string | null; startsAt?: string | null; dueAt?: string | null; isMilestone?: boolean; labels?: string[] }) {
    await this.get(user, projectId);
    if (!body || typeof body !== 'object') throw new BadRequestException('Alteração de tarefa inválida');
    await this.assertCompanyUser(user.companyId, body.assigneeId, 'Responsável');
    const task = await this.db.projectTask.findFirst({ where: { id: taskId, projectId } });
    if (!task) throw new NotFoundException('Tarefa não encontrada');
    if (body.status && !['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'].includes(body.status)) throw new BadRequestException('Status inválido');
    if (body.priority && !['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(body.priority)) throw new BadRequestException('Prioridade inválida');
    if (body.title !== undefined && (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 200)) throw new BadRequestException('O título deve ter entre 1 e 200 caracteres');
    const startsAt = body.startsAt ? new Date(body.startsAt) : null;
    const dueAt = body.dueAt ? new Date(body.dueAt) : null;
    if (body.startsAt && (!startsAt || Number.isNaN(startsAt.getTime()))) throw new BadRequestException('Data de início inválida');
    if (body.dueAt && (!dueAt || Number.isNaN(dueAt.getTime()))) throw new BadRequestException('Prazo inválido');
    const effectiveStart = body.startsAt === undefined ? task.startsAt && new Date(task.startsAt) : startsAt;
    const effectiveDue = body.dueAt === undefined ? task.dueAt && new Date(task.dueAt) : dueAt;
    if (effectiveStart && effectiveDue && effectiveStart > effectiveDue) throw new BadRequestException('A data de início deve ser anterior ao prazo');
    if (body.isMilestone !== undefined && typeof body.isMilestone !== 'boolean') throw new BadRequestException('Marco inválido');
    if (body.labels !== undefined && (!Array.isArray(body.labels) || body.labels.length > 12 || body.labels.some((label) => typeof label !== 'string' || label.trim().length > 40))) throw new BadRequestException('Use até 12 etiquetas com no máximo 40 caracteres');
    const updated = await this.db.projectTask.update({
      where: { id: taskId },
      data: {
        ...(body.title !== undefined ? { title: body.title.trim() } : {}),
        ...(body.description !== undefined ? { description: body.description.trim() || null } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.priority !== undefined ? { priority: body.priority } : {}),
        ...(body.assigneeId !== undefined ? { assigneeId: body.assigneeId } : {}),
        ...(body.startsAt !== undefined ? { startsAt } : {}),
        ...(body.dueAt !== undefined ? { dueAt } : {}),
        ...(body.isMilestone !== undefined ? { isMilestone: body.isMilestone } : {}),
        ...(body.status === 'DONE' && task.status !== 'DONE' ? { completedAt: new Date() } : {}),
        ...(body.status !== undefined && body.status !== 'DONE' && task.status === 'DONE' ? { completedAt: null } : {}),
        ...(body.labels !== undefined ? { labels: [...new Set(body.labels.map((label) => label.trim()).filter(Boolean))] } : {}),
      },
    });
    if (body.status === 'DONE' && task.status !== 'DONE') await recordActivity(this.db, user, { eventType: 'task.completed', module: 'projects', title: 'Tarefa concluída', entityType: 'task', entityId: taskId, projectId, href: `/projects?projectId=${projectId}&taskId=${taskId}` });
    if (body.assigneeId && body.assigneeId !== task.assigneeId) await recordActivity(this.db, user, { eventType: 'task.assigned', module: 'projects', title: 'Tarefa atribuída', entityType: 'task', entityId: taskId, projectId, href: `/projects?projectId=${projectId}&taskId=${taskId}` });
    return updated;
  }

  async deleteTask(user: AuthUser, projectId: string, taskId: string) {
    await this.get(user, projectId);
    const task = await this.db.projectTask.findFirst({ where: { id: taskId, projectId }, select: { id: true } });
    if (!task) throw new NotFoundException('Tarefa não encontrada');
    return this.db.projectTask.deleteMany({ where: { id: taskId } });
  }

  async comments(user: AuthUser, projectId: string, taskId: string) {
    await this.get(user, projectId);
    const task = await this.db.projectTask.findFirst({ where: { id: taskId, projectId }, select: { id: true } });
    if (!task) throw new NotFoundException('Tarefa não encontrada');
    return this.db.projectTaskComment.findMany({ where: { taskId }, include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' }, take: 200 });
  }

  async addComment(user: AuthUser, projectId: string, taskId: string, body: string) {
    await this.get(user, projectId);
    const task = await this.db.projectTask.findFirst({ where: { id: taskId, projectId }, select: { id: true } });
    if (!task) throw new NotFoundException('Tarefa não encontrada');
    const text = typeof body === 'string' ? body.trim() : '';
    if (!text || text.length > 10000) throw new BadRequestException('Comentário deve ter entre 1 e 10000 caracteres');
    const comment = await this.db.projectTaskComment.create({ data: { taskId, authorId: user.id, body: text } });
    await recordActivity(this.db, user, { eventType: 'comment.created', module: 'projects', title: 'Comentário adicionado', entityType: 'task', entityId: taskId, projectId, href: `/projects?projectId=${projectId}&taskId=${taskId}` });
    return comment;
  }

  async editComment(user: AuthUser, projectId: string, taskId: string, commentId: string, body: string) {
    await this.get(user, projectId);
    const task = await this.db.projectTask.findFirst({ where: { id: taskId, projectId }, select: { id: true } });
    if (!task) throw new NotFoundException('Tarefa não encontrada');
    const comment = await this.db.projectTaskComment.findFirst({ where: { id: commentId, taskId } });
    if (!comment) throw new NotFoundException('Comentário não encontrado');
    if (comment.authorId !== user.id) throw new ForbiddenException('Somente o autor pode editar este comentário');
    const text = typeof body === 'string' ? body.trim() : '';
    if (!text || text.length > 10000) throw new BadRequestException('Comentário deve ter entre 1 e 10000 caracteres');
    return this.db.projectTaskComment.update({ where: { id: commentId }, data: { body: text, updatedAt: new Date() } });
  }

  async deleteComment(user: AuthUser, projectId: string, taskId: string, commentId: string) {
    await this.get(user, projectId);
    const task = await this.db.projectTask.findFirst({ where: { id: taskId, projectId }, select: { id: true } });
    if (!task) throw new NotFoundException('Tarefa não encontrada');
    const comment = await this.db.projectTaskComment.findFirst({ where: { id: commentId, taskId } });
    if (!comment) throw new NotFoundException('Comentário não encontrado');
    if (comment.authorId !== user.id && !['OWNER', 'ADMIN', 'MANAGER'].includes(user.role)) throw new ForbiddenException('Sem permissão para excluir este comentário');
    return this.db.projectTaskComment.deleteMany({ where: { id: commentId } });
  }

  async dependencies(user: AuthUser, projectId: string, taskId: string) {
    await this.get(user, projectId);
    const task = await this.db.projectTask.findFirst({ where: { id: taskId, projectId }, select: { id: true } });
    if (!task) throw new NotFoundException('Tarefa não encontrada');
    return this.db.projectTaskDependency.findMany({ where: { taskId }, orderBy: { createdAt: 'asc' }, take: 200 });
  }

  async addDependency(user: AuthUser, projectId: string, taskId: string, dependsOnTaskId: string) {
    await this.get(user, projectId);
    if (taskId === dependsOnTaskId) throw new BadRequestException('Uma tarefa não pode depender de si mesma');
    const [task, dependency] = await Promise.all([
      this.db.projectTask.findFirst({ where: { id: taskId, projectId }, select: { id: true } }),
      this.db.projectTask.findFirst({ where: { id: dependsOnTaskId, projectId }, select: { id: true } }),
    ]);
    if (!task || !dependency) throw new BadRequestException('As tarefas devem pertencer ao mesmo projeto');
    const existing = await this.db.projectTaskDependency.findFirst({ where: { taskId, dependsOnTaskId } });
    if (existing) return existing;
    const pending = [dependsOnTaskId];
    const visited = new Set<string>();
    while (pending.length && visited.size < 500) {
      const current = pending.pop()!;
      if (current === taskId) throw new BadRequestException('Esta dependência criaria um ciclo');
      if (visited.has(current)) continue;
      visited.add(current);
      const edges = await this.db.projectTaskDependency.findMany({ where: { taskId: current }, take: 500 });
      pending.push(...edges.map((edge: { dependsOnTaskId: string }) => edge.dependsOnTaskId));
    }
    if (pending.length) throw new BadRequestException('Não foi possível validar uma cadeia de dependências extensa');
    return this.db.projectTaskDependency.create({ data: { taskId, dependsOnTaskId, createdById: user.id } });
  }

  async removeDependency(user: AuthUser, projectId: string, taskId: string, dependsOnTaskId: string) {
    await this.get(user, projectId);
    const task = await this.db.projectTask.findFirst({ where: { id: taskId, projectId }, select: { id: true } });
    if (!task) throw new NotFoundException('Tarefa não encontrada');
    return this.db.projectTaskDependency.deleteMany({ where: { taskId, dependsOnTaskId } });
  }
}
