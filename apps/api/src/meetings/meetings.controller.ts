import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators';
import { MeetingsService } from './meetings.service';

@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.meetings.list(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: { name: string; description?: string; startsAt: string; durationMinutes: number; accessMode?: string; participantIds?: string[] }) {
    return this.meetings.create(user, body);
  }

  @Post('join')
  join(@CurrentUser() user: AuthUser, @Body() body: { code: string }) {
    return this.meetings.joinByCode(user, body.code);
  }

  @Get(':code')
  get(@CurrentUser() user: AuthUser, @Param('code') code: string) {
    return this.meetings.getByCode(user, code);
  }
}
