import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { SupabaseDataService } from '../supabase/supabase.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly db: SupabaseDataService) {}

  list(user: AuthUser) {
    return this.db.notification.findMany({ where: { companyId: user.companyId, userId: user.id }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async markRead(user: AuthUser, id: string) {
    const notification = await this.db.notification.findFirst({ where: { id, companyId: user.companyId, userId: user.id } });
    if (!notification) throw new NotFoundException('Notificação não encontrada');
    return this.db.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  markAllRead(user: AuthUser) {
    return this.db.notification.updateMany({ where: { companyId: user.companyId, userId: user.id, readAt: null }, data: { readAt: new Date() } });
  }
}
