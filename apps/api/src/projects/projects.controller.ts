import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { CurrentUser, MinRole, RequirePermission } from '../common/decorators';
import { Role } from '../common/domain-types';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @RequirePermission('projects', 'view')
  list(@CurrentUser() user: AuthUser) {
    return this.projects.list(user);
  }

  @Post()
  @MinRole(Role.MANAGER)
  @RequirePermission('projects', 'create')
  create(@CurrentUser() user: AuthUser, @Body() body: { name: string; description?: string; dueAt?: string; ownerId?: string }) {
    return this.projects.create(user, body);
  }

  @Get(':id')
  @RequirePermission('projects', 'view')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.projects.get(user, id);
  }

  @Get(':id/dependencies')
  @RequirePermission('projects', 'view')
  allDependencies(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.projects.projectDependencies(user, id);
  }

  @Patch(':id')
  @MinRole(Role.MANAGER)
  @RequirePermission('projects', 'edit')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { name?: string; description?: string; status?: string; dueAt?: string | null; ownerId?: string | null }) {
    return this.projects.update(user, id, body);
  }

  @Post(':id/tasks')
  @MinRole(Role.MANAGER)
  @RequirePermission('projects', 'create')
  createTask(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { title: string; description?: string; status?: string; priority?: string; assigneeId?: string; startsAt?: string; dueAt?: string; isMilestone?: boolean; parentTaskId?: string; labels?: string[] }) {
    return this.projects.createTask(user, id, body);
  }

  @Patch(':id/tasks/:taskId')
  @RequirePermission('projects', 'edit')
  updateTask(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('taskId') taskId: string, @Body() body: { title?: string; description?: string; status?: string; priority?: string; assigneeId?: string | null; startsAt?: string | null; dueAt?: string | null; isMilestone?: boolean; labels?: string[] }) {
    return this.projects.updateTask(user, id, taskId, body);
  }

  @Delete(':id/tasks/:taskId')
  @RequirePermission('projects', 'edit')
  deleteTask(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('taskId') taskId: string) { return this.projects.deleteTask(user, id, taskId); }

  @Get(':id/tasks/:taskId/comments')
  @RequirePermission('projects', 'view')
  comments(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('taskId') taskId: string) { return this.projects.comments(user, id, taskId); }

  @Post(':id/tasks/:taskId/comments')
  @RequirePermission('projects', 'edit')
  addComment(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('taskId') taskId: string, @Body() body: { body: string }) { return this.projects.addComment(user, id, taskId, body.body); }

  @Patch(':id/tasks/:taskId/comments/:commentId')
  @RequirePermission('projects', 'edit')
  editComment(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('taskId') taskId: string, @Param('commentId') commentId: string, @Body() body: { body: string }) { return this.projects.editComment(user, id, taskId, commentId, body.body); }

  @Delete(':id/tasks/:taskId/comments/:commentId')
  @RequirePermission('projects', 'edit')
  deleteComment(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('taskId') taskId: string, @Param('commentId') commentId: string) { return this.projects.deleteComment(user, id, taskId, commentId); }

  @Get(':id/tasks/:taskId/dependencies')
  @RequirePermission('projects', 'view')
  dependencies(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('taskId') taskId: string) { return this.projects.dependencies(user, id, taskId); }

  @Post(':id/tasks/:taskId/dependencies')
  @RequirePermission('projects', 'edit')
  addDependency(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('taskId') taskId: string, @Body() body: { dependsOnTaskId: string }) { return this.projects.addDependency(user, id, taskId, body.dependsOnTaskId); }

  @Delete(':id/tasks/:taskId/dependencies/:dependsOnTaskId')
  @RequirePermission('projects', 'edit')
  removeDependency(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('taskId') taskId: string, @Param('dependsOnTaskId') dependsOnTaskId: string) { return this.projects.removeDependency(user, id, taskId, dependsOnTaskId); }
}
