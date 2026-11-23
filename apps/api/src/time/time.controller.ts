import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { Role } from '../common/domain-types';
import { CurrentUser, MinRole, RequirePermission } from '../common/decorators';
import { ClockDto, HistoryQueryDto } from './dto/time.dto';
import { TimeService } from './time.service';

@Controller('time')
export class TimeController {
  constructor(private readonly time: TimeService) {}

  @Post('clock')
  @RequirePermission('time', 'create')
  @HttpCode(201)
  clock(@CurrentUser() user: AuthUser, @Body() dto: ClockDto) {
    return this.time.clock(user, dto);
  }

  @Get('today')
  @RequirePermission('time', 'view')
  today(@CurrentUser() user: AuthUser) {
    return this.time.today(user);
  }

  @Get('history')
  @RequirePermission('time', 'view')
  history(@CurrentUser() user: AuthUser, @Query() query: HistoryQueryDto) {
    return this.time.history(user, query);
  }

  @Get('team')
  @MinRole(Role.MANAGER)
  @RequirePermission('time', 'view')
  team(@CurrentUser() user: AuthUser) {
    return this.time.team(user.companyId);
  }
}
