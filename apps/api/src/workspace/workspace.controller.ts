import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { CurrentUser, RequirePermission } from '../common/decorators';
import { WorkspaceService } from './workspace.service';

@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly workspace: WorkspaceService) {}

  @Get('preferences')
  preferences(@CurrentUser() user: AuthUser) { return this.workspace.getPreferences(user); }

  @Patch('preferences')
  savePreferences(@CurrentUser() user: AuthUser, @Body() body: { order: string[]; hidden: string[] }) { return this.workspace.savePreferences(user, body); }

  @Get('focus')
  @RequirePermission('projects', 'view')
  focus(@CurrentUser() user: AuthUser) { return this.workspace.focus(user); }

  @Post('focus')
  @RequirePermission('projects', 'view')
  startFocus(@CurrentUser() user: AuthUser, @Body() body: { taskId: string }) { return this.workspace.startFocus(user, body.taskId); }

  @Post('focus/pause')
  @RequirePermission('projects', 'view')
  pauseFocus(@CurrentUser() user: AuthUser) { return this.workspace.pauseFocus(user); }

  @Post('focus/resume')
  @RequirePermission('projects', 'view')
  resumeFocus(@CurrentUser() user: AuthUser) { return this.workspace.resumeFocus(user); }

  @Post('focus/finish')
  @RequirePermission('projects', 'view')
  finishFocus(@CurrentUser() user: AuthUser) { return this.workspace.finishFocus(user); }
}
