import { Controller, Get, Param, Patch } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.notifications.list(user);
  }

  @Patch(':id/read')
  read(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notifications.markRead(user, id);
  }

  @Patch('read-all')
  readAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user);
  }
}
