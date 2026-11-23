import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { AuthUser } from '../common/auth-user';
import { SupabaseDataService } from '../supabase/supabase.service';
import { recordActivity } from '../activity/activity-writer';

@Injectable()
export class MeetingsService {
  constructor(private readonly db: SupabaseDataService) {}

  list(user: AuthUser) {
    return this.db.meeting.findMany({
      where: { companyId: user.companyId },
      include: { participants: true },
      orderBy: { startsAt: 'asc' },
    }).then((meetings: any[]) => meetings.filter((meeting) => meeting.accessMode !== 'PRIVATE' || meeting.createdById === user.id || meeting.participants.some((participant: any) => participant.userId === user.id)));
  }

  async create(user: AuthUser, body: { name: string; description?: string; startsAt: string; durationMinutes: number; accessMode?: string; participantIds?: string[] }) {
    const name = body.name?.trim();
    const startsAt = new Date(body.startsAt);
    if (!name || Number.isNaN(startsAt.getTime())) throw new BadRequestException('Nome e data/hora são obrigatórios');
    const durationMinutes = body.durationMinutes;
    const code = randomBytes(5).toString('hex').toUpperCase();
    const participantIds = [...new Set([user.id, ...(body.participantIds ?? [])])];
    const validParticipants = await this.db.user.findMany({ where: { id: { in: participantIds }, companyId: user.companyId, active: true }, select: { id: true } });
    const meeting = await this.db.meeting.create({
      data: {
        companyId: user.companyId,
        name,
        description: body.description?.trim() || null,
        startsAt,
        durationMinutes,
        accessMode: body.accessMode === 'PRIVATE' ? 'PRIVATE' : 'TEAM',
        code,
        createdById: user.id,
        participants: { create: validParticipants.map((participant: any) => ({ userId: participant.id })) },
      },
      include: { participants: true },
    });
    await this.db.notification.createMany({
      data: validParticipants.filter((participant: any) => participant.id !== user.id).map((participant: any) => ({
        companyId: user.companyId,
        userId: participant.id,
        title: 'Convite para reunião',
        body: name,
        href: `/meetings?code=${code}`,
      })),
    });
    if (meeting.accessMode === 'PRIVATE') {
      await Promise.all(validParticipants.map((participant: any) => recordActivity(this.db, user, {
        eventType: 'meeting.scheduled', module: 'meetings', title: 'Reunião agendada',
        entityType: 'meeting', entityId: meeting.id, targetUserId: participant.id,
        href: `/meetings?meetingId=${meeting.id}`,
      })));
    } else {
      await recordActivity(this.db, user, {
        eventType: 'meeting.scheduled', module: 'meetings', title: 'Reunião agendada',
        entityType: 'meeting', entityId: meeting.id, href: `/meetings?meetingId=${meeting.id}`,
      });
    }
    return meeting;
  }

  async getByCode(user: AuthUser, code: string) {
    const meeting = await this.db.meeting.findFirst({ where: { companyId: user.companyId, code: code.trim().toUpperCase() }, include: { participants: true } });
    if (!meeting) throw new NotFoundException('Reunião não encontrada');
    if (meeting.accessMode === 'PRIVATE' && meeting.createdById !== user.id && !meeting.participants.some((participant: any) => participant.userId === user.id)) {
      throw new ForbiddenException('Você não foi convidado para esta reunião');
    }
    return meeting;
  }

  async joinByCode(user: AuthUser, code: string) {
    const meeting = await this.getByCode(user, code);
    const endsAt = new Date(meeting.startsAt.getTime() + meeting.durationMinutes * 60_000);
    if (endsAt <= new Date()) throw new BadRequestException('Esta reunião já foi encerrada');
    if (meeting.accessMode === 'PRIVATE' && meeting.createdById !== user.id && !meeting.participants.some((participant: any) => participant.userId === user.id)) {
      throw new ForbiddenException('Você não foi convidado para esta reunião');
    }
    await this.db.meetingParticipant.upsert({
      where: { meetingId_userId: { meetingId: meeting.id, userId: user.id } },
      update: { joinedAt: new Date() },
      create: { meetingId: meeting.id, userId: user.id, joinedAt: new Date() },
    });
    return this.getByCode(user, code);
  }
}
