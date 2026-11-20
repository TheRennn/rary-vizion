import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { CurrentUser, MinRole } from '../common/decorators';
import { Role } from '../common/domain-types';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.projects.list(user);
  }

  @Post()
  @MinRole(Role.MANAGER)
  create(@CurrentUser() user: AuthUser, @Body() body: { name: string; description?: string; dueAt?: string; ownerId?: string }) {
    return this.projects.create(user, body);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.projects.get(user, id);
  }

  @Patch(':id')
  @MinRole(Role.MANAGER)
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { name?: string; description?: string; status?: string; dueAt?: string | null; ownerId?: string | null }) {
    return this.projects.update(user, id, body);
  }

  @Post(':id/tasks')
  @MinRole(Role.MANAGER)
  createTask(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { title: string; description?: string; status?: string; priority?: string; assigneeId?: string; dueAt?: string }) {
    return this.projects.createTask(user, id, body);
  }

  @Patch(':id/tasks/:taskId')
  updateTask(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('taskId') taskId: string, @Body() body: { title?: string; description?: string; status?: string; priority?: string; assigneeId?: string | null; dueAt?: string | null }) {
    return this.projects.updateTask(user, id, taskId, body);
  }
}
