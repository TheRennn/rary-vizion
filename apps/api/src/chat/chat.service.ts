import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateGroupConversationDto,
  ListMessagesQueryDto,
  SearchMessagesQueryDto,
} from './dto/chat.dto';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async searchMessages(user: AuthUser, query: SearchMessagesQueryDto) {
    const term = query.q.trim();
    if (term.length < 2) throw new BadRequestException('Digite ao menos dois caracteres para pesquisar');

    const results = await this.prisma.chatMessage.findMany({
      where: {
        body: { contains: term },
        conversation: {
          companyId: user.companyId,
          participants: { some: { userId: user.id } },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit ?? 20,
      include: {
        sender: { select: { id: true, name: true } },
        conversation: {
          select: {
            id: true,
            name: true,
            participants: {
              where: { userId: { not: user.id } },
              take: 1,
              select: { user: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });

    return results.map(({ conversation, ...message }) => ({
      ...message,
      conversation: {
        id: conversation.id,
        name: conversation.name,
        peerName: conversation.name ?? conversation.participants[0]?.user.name ?? 'Conversa',
      },
    }));
  }

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
        type: conversation.type,
        peer: conversation.type === 'DIRECT' ? peer : null,
        participants: conversation.participants.map((participant) => participant.user),
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
      return {
        id: existing.id,
        name: existing.name,
        type: existing.type,
        peer,
        participants: existing.participants.map((participant) => participant.user),
        updatedAt: existing.updatedAt,
        lastMessage: existing.messages[0] ?? null,
        unread: false,
      };
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

    return {
      id: conversation.id,
      name: null,
      type: conversation.type,
      peer: target,
      participants: conversation.participants.map((participant) => participant.user),
      updatedAt: conversation.updatedAt,
      lastMessage: null,
      unread: false,
    };
  }

  async createGroupConversation(user: AuthUser, dto: CreateGroupConversationDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Informe um nome para o grupo');

    const participantIds = dto.participantIds.filter((id) => id !== user.id);
    if (participantIds.length < 2) {
      throw new BadRequestException('Um grupo precisa de pelo menos duas outras pessoas');
    }

    const participants = await this.prisma.user.findMany({
      where: {
        id: { in: participantIds },
        companyId: user.companyId,
        active: true,
      },
      select: { id: true },
    });
    if (participants.length !== participantIds.length) {
      throw new BadRequestException('Um ou mais participantes são inválidos');
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        companyId: user.companyId,
        type: 'GROUP',
        name,
        participants: {
          create: [user.id, ...participantIds].map((userId) => ({ userId })),
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true, jobTitle: true, active: true },
            },
          },
        },
      },
    });

    return {
      id: conversation.id,
      name: conversation.name,
      type: conversation.type,
      peer: null,
      participants: conversation.participants.map((participant) => participant.user),
      updatedAt: conversation.updatedAt,
      lastMessage: null,
      unread: false,
    };
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
