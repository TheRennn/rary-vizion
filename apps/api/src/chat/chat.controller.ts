import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators';
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
  search(@CurrentUser() user: AuthUser, @Query() query: SearchMessagesQueryDto) {
    return this.chat.searchMessages(user, query);
  }

  @Get('conversations')
  conversations(@CurrentUser() user: AuthUser) {
    return this.chat.listConversations(user);
  }

  @Post('conversations')
  createConversation(@CurrentUser() user: AuthUser, @Body() dto: CreateConversationDto) {
    return this.chat.createConversation(user, dto.targetUserId);
  }

  @Post('conversations/groups')
  createGroupConversation(@CurrentUser() user: AuthUser, @Body() dto: CreateGroupConversationDto) {
    return this.chat.createGroupConversation(user, dto);
  }

  @Get('conversations/:id/messages')
  messages(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.chat.listMessages(user, id, query);
  }

  @Post('conversations/:id/messages')
  send(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.chat.sendMessage(user, id, dto.body);
  }

  @Patch('conversations/:id/read')
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.chat.markRead(user, id);
  }
}
