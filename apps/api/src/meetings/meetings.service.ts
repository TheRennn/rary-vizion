import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { AuthUser } from '../common/auth-user';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MeetingsService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: AuthUser) {
    return this.prisma.meeting.findMany({
      where: { companyId: user.companyId },
      include: { participants: true },
      orderBy: { startsAt: 'asc' },
    });
  }

  async create(user: AuthUser, body: { name: string; description?: string; startsAt: string; durationMinutes: number; accessMode?: string; participantIds?: string[] }) {
    const name = body.name?.trim();
    const startsAt = new Date(body.startsAt);
    if (!name || Number.isNaN(startsAt.getTime())) throw new BadRequestException('Nome e data/hora são obrigatórios');
    const durationMinutes = Math.min(480, Math.max(15, Number(body.durationMinutes) || 30));
    const code = randomBytes(5).toString('hex').toUpperCase();
    const participantIds = [...new Set([user.id, ...(body.participantIds ?? [])])];
    const validParticipants = await this.prisma.user.findMany({ where: { id: { in: participantIds }, companyId: user.companyId, active: true }, select: { id: true } });
    const meeting = await this.prisma.meeting.create({
      data: {
        companyId: user.companyId,
        name,
        description: body.description?.trim() || null,
        startsAt,
        durationMinutes,
        accessMode: body.accessMode === 'PRIVATE' ? 'PRIVATE' : 'TEAM',
        code,
        createdById: user.id,
        participants: { create: validParticipants.map((participant) => ({ userId: participant.id })) },
      },
      include: { participants: true },
    });
    await this.prisma.notification.createMany({
      data: validParticipants.filter((participant) => participant.id !== user.id).map((participant) => ({
        companyId: user.companyId,
        userId: participant.id,
        title: 'Convite para reunião',
        body: name,
        href: `/meetings?code=${code}`,
      })),
    });
    return meeting;
  }

  async getByCode(user: AuthUser, code: string) {
    const meeting = await this.prisma.meeting.findFirst({ where: { companyId: user.companyId, code: code.trim().toUpperCase() }, include: { participants: true } });
    if (!meeting) throw new NotFoundException('Reunião não encontrada');
    return meeting;
  }

  async joinByCode(user: AuthUser, code: string) {
    const meeting = await this.getByCode(user, code);
    await this.prisma.meetingParticipant.upsert({
      where: { meetingId_userId: { meetingId: meeting.id, userId: user.id } },
      update: { joinedAt: new Date() },
      create: { meetingId: meeting.id, userId: user.id, joinedAt: new Date() },
    });
    return this.getByCode(user, code);
  }
}
