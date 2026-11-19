import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { ListMessagesQueryDto } from './dto/chat.dto';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async listConversations(user: AuthUser) {
    const memberships = await this.prisma.conversationParticipant.findMany({
      where: { userId: user.id, conversation: { companyId: user.companyId } },
      orderBy: { conversation: { updatedAt: 'desc' } },
      include: {
        conversation: {
          include: {
            participants: {
              include: { user: { select: { id: true, name: true, email: true, jobTitle: true, active: true } } },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { sender: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });

    return memberships.map(({ conversation, lastReadAt }) => {
      const peer = conversation.participants.find((participant) => participant.userId !== user.id)?.user ?? null;
      const lastMessage = conversation.messages[0] ?? null;
      return {
        id: conversation.id,
        name: conversation.name,
        peer,
        updatedAt: conversation.updatedAt,
        lastMessage,
        unread: !!lastMessage &&
          lastMessage.senderId !== user.id &&
          (!lastReadAt || lastMessage.createdAt > lastReadAt),
      };
    });
  }

  async createConversation(user: AuthUser, targetUserId: string) {
    if (targetUserId === user.id) throw new BadRequestException('Não é possível iniciar uma conversa consigo mesmo');

    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, companyId: user.companyId, active: true },
      select: { id: true, name: true, email: true, jobTitle: true, active: true },
    });
    if (!target) throw new NotFoundException('Colaborador não encontrado');

    const existing = await this.prisma.conversation.findFirst({
      where: {
        companyId: user.companyId,
        type: 'DIRECT',
        AND: [
          { participants: { some: { userId: user.id } } },
          { participants: { some: { userId: targetUserId } } },
        ],
      },
      include: {
        participants: { include: { user: { select: { id: true, name: true, email: true, jobTitle: true, active: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, include: { sender: { select: { id: true, name: true } } } },
      },
    });

    if (existing) {
      const peer = existing.participants.find((participant) => participant.userId !== user.id)?.user ?? target;
      return { id: existing.id, name: existing.name, peer, updatedAt: existing.updatedAt, lastMessage: existing.messages[0] ?? null, unread: false };
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        companyId: user.companyId,
        type: 'DIRECT',
        participants: { create: [{ userId: user.id }, { userId: targetUserId }] },
      },
      include: {
        participants: { include: { user: { select: { id: true, name: true, email: true, jobTitle: true, active: true } } } },
      },
    });

    return { id: conversation.id, name: null, peer: target, updatedAt: conversation.updatedAt, lastMessage: null, unread: false };
  }

  private async requireMembership(user: AuthUser, conversationId: string) {
    const membership = await this.prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId: user.id,
        conversation: { companyId: user.companyId },
      },
    });
    if (!membership) throw new ForbiddenException('Você não participa desta conversa');
  }

  async listMessages(
    user: AuthUser,
    conversationId: string,
    query: ListMessagesQueryDto,
  ) {
    await this.requireMembership(user, conversationId);
    const limit = query.limit ?? 50;
    if (query.before) {
      const cursor = await this.prisma.chatMessage.findFirst({
        where: { id: query.before, conversationId },
        select: { id: true },
      });
      if (!cursor) throw new BadRequestException('Cursor de mensagem inválido');
    }

    const page = await this.prisma.chatMessage.findMany({
      where: { conversationId },
      ...(query.before ? { cursor: { id: query.before }, skip: 1 } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: { sender: { select: { id: true, name: true } } },
    });
    const hasMore = page.length > limit;

    return {
      items: page.slice(0, limit).reverse(),
      hasMore,
    };
  }

  async sendMessage(user: AuthUser, conversationId: string, body: string) {
    await this.requireMembership(user, conversationId);
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.chatMessage.create({
        data: { conversationId, senderId: user.id, body: body.trim() },
        include: { sender: { select: { id: true, name: true } } },
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
      return created;
    });
  }

  async markRead(user: AuthUser, conversationId: string) {
    await this.requireMembership(user, conversationId);
    return this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: user.id } },
      data: { lastReadAt: new Date() },
      select: { lastReadAt: true },
    });
  }
}
