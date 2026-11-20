import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser) {
    return this.prisma.project.findMany({
      where: { companyId: user.companyId },
      include: { tasks: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(user: AuthUser, body: { name: string; description?: string; dueAt?: string; ownerId?: string }) {
    const name = body.name?.trim();
    if (!name) throw new BadRequestException('Informe o nome do projeto');
    return this.prisma.project.create({
      data: { companyId: user.companyId, name, description: body.description?.trim() || null, dueAt: body.dueAt ? new Date(body.dueAt) : null, ownerId: body.ownerId || user.id },
      include: { tasks: true },
    });
  }

  async get(user: AuthUser, id: string) {
    const project = await this.prisma.project.findFirst({ where: { id, companyId: user.companyId }, include: { tasks: true } });
    if (!project) throw new NotFoundException('Projeto não encontrado');
    return project;
  }

  async update(user: AuthUser, id: string, body: { name?: string; description?: string; status?: string; dueAt?: string | null; ownerId?: string | null }) {
    await this.get(user, id);
    if (body.status && !['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'].includes(body.status)) throw new BadRequestException('Status inválido');
    return this.prisma.project.update({
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

  async createTask(user: AuthUser, projectId: string, body: { title: string; description?: string; status?: string; priority?: string; assigneeId?: string; dueAt?: string }) {
    await this.get(user, projectId);
    const title = body.title?.trim();
    if (!title) throw new BadRequestException('Informe o título da tarefa');
    return this.prisma.projectTask.create({
      data: {
        projectId,
        title,
        description: body.description?.trim() || null,
        status: body.status ?? 'TODO',
        priority: body.priority ?? 'MEDIUM',
        assigneeId: body.assigneeId || null,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
      },
    });
  }

  async updateTask(user: AuthUser, projectId: string, taskId: string, body: { title?: string; description?: string; status?: string; priority?: string; assigneeId?: string | null; dueAt?: string | null }) {
    await this.get(user, projectId);
    const task = await this.prisma.projectTask.findFirst({ where: { id: taskId, projectId } });
    if (!task) throw new NotFoundException('Tarefa não encontrada');
    if (body.status && !['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'].includes(body.status)) throw new BadRequestException('Status inválido');
    if (body.priority && !['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(body.priority)) throw new BadRequestException('Prioridade inválida');
    return this.prisma.projectTask.update({
      where: { id: taskId },
      data: {
        ...(body.title !== undefined ? { title: body.title.trim() } : {}),
        ...(body.description !== undefined ? { description: body.description.trim() || null } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.priority !== undefined ? { priority: body.priority } : {}),
        ...(body.assigneeId !== undefined ? { assigneeId: body.assigneeId } : {}),
        ...(body.dueAt !== undefined ? { dueAt: body.dueAt ? new Date(body.dueAt) : null } : {}),
      },
    });
  }
}
