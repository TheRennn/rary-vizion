import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { CurrentUser, RequirePermission } from '../common/decorators';
import { CalendarService } from './calendar.service';

@Controller('calendar')
@RequirePermission('workspace', 'view')
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}
  @Get() list(@CurrentUser() user: AuthUser, @Query('from') from: string, @Query('to') to: string) { return this.calendar.list(user, from, to); }
  @Post() create(@CurrentUser() user: AuthUser, @Body() body: { title: string; description?: string; category?: string; accessMode?: string; startsAt: string; endsAt: string }) { return this.calendar.create(user, body); }
  @Patch(':id') update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { title?: string; description?: string | null; category?: string; accessMode?: string; startsAt?: string; endsAt?: string }) { return this.calendar.update(user, id, body); }
  @Delete(':id') remove(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.calendar.remove(user, id); }
}
