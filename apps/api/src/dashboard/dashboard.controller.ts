import { Controller, Get, Query } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { CurrentUser, MinRole, RequirePermission } from '../common/decorators';
import { Role } from '../common/domain-types';
import { DashboardQueryDto } from './dashboard.dto';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('overview')
  @MinRole(Role.MANAGER)
  @RequirePermission('dashboard', 'view')
  overview(@CurrentUser() user: AuthUser, @Query() query: DashboardQueryDto) {
    return this.dashboard.overview(user, query.period, query.departmentId);
  }
}
