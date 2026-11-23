import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { CurrentUser, RequirePermission } from '../common/decorators';
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto, JoinMeetingDto } from './dto/meeting.dto';

@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Get()
  @RequirePermission('meetings', 'view')
  list(@CurrentUser() user: AuthUser) {
    return this.meetings.list(user);
  }

  @Post()
  @RequirePermission('meetings', 'create')
  create(@CurrentUser() user: AuthUser, @Body() body: CreateMeetingDto) {
    return this.meetings.create(user, body);
  }

  @Post('join')
  @RequirePermission('meetings', 'view')
  join(@CurrentUser() user: AuthUser, @Body() body: JoinMeetingDto) {
    return this.meetings.joinByCode(user, body.code);
  }

  @Get(':code')
  @RequirePermission('meetings', 'view')
  get(@CurrentUser() user: AuthUser, @Param('code') code: string) {
    return this.meetings.getByCode(user, code);
  }
}
