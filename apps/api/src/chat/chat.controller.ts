import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { CurrentUser, RequirePermission } from '../common/decorators';
import { ChatService } from './chat.service';
import {
  CreateConversationDto,
  CreateGroupConversationDto,
  ListMessagesQueryDto,
  SearchMessagesQueryDto,
  SendMessageDto,
} from './dto/chat.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('search')
  @RequirePermission('chat', 'view')
  search(@CurrentUser() user: AuthUser, @Query() query: SearchMessagesQueryDto) {
    return this.chat.searchMessages(user, query);
  }

  @Get('conversations')
  @RequirePermission('chat', 'view')
  conversations(@CurrentUser() user: AuthUser) {
    return this.chat.listConversations(user);
  }

  @Post('conversations')
  @RequirePermission('chat', 'create')
  createConversation(@CurrentUser() user: AuthUser, @Body() dto: CreateConversationDto) {
    return this.chat.createConversation(user, dto.targetUserId);
  }

  @Post('conversations/groups')
  @RequirePermission('chat', 'create')
  createGroupConversation(@CurrentUser() user: AuthUser, @Body() dto: CreateGroupConversationDto) {
    return this.chat.createGroupConversation(user, dto);
  }

  @Get('conversations/:id/messages')
  @RequirePermission('chat', 'view')
  messages(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.chat.listMessages(user, id, query);
  }

  @Post('conversations/:id/messages')
  @RequirePermission('chat', 'create')
  send(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.chat.sendMessage(user, id, dto.body);
  }

  @Patch('conversations/:id/read')
  @RequirePermission('chat', 'view')
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.chat.markRead(user, id);
  }
}
