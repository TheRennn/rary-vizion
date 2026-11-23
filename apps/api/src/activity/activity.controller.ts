import { Controller, Get, Query } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { CurrentUser, RequirePermission } from '../common/decorators';
import { ActivityService } from './activity.service';

@Controller('activity')
@RequirePermission('dashboard', 'view')
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: { module?: string; from?: string; to?: string; projectId?: string; q?: string; cursor?: string }) {
    return this.activity.list(user, query);
  }
}
