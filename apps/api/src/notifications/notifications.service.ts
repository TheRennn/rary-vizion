import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: AuthUser) {
    return this.prisma.notification.findMany({ where: { companyId: user.companyId, userId: user.id }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async markRead(user: AuthUser, id: string) {
    const notification = await this.prisma.notification.findFirst({ where: { id, companyId: user.companyId, userId: user.id } });
    if (!notification) throw new NotFoundException('Notificação não encontrada');
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  markAllRead(user: AuthUser) {
    return this.prisma.notification.updateMany({ where: { companyId: user.companyId, userId: user.id, readAt: null }, data: { readAt: new Date() } });
  }
}
