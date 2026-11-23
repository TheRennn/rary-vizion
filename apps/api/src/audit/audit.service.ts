import { Injectable } from '@nestjs/common';
import { SupabaseDataService } from '../supabase/supabase.service';

export interface AuditEvent {
  companyId?: string | null;
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(private readonly db: SupabaseDataService) {}

  async log(event: AuditEvent): Promise<void> {
    await this.db.auditLog.create({
      data: {
        companyId: event.companyId ?? null,
        actorId: event.actorId ?? null,
        action: event.action,
        entity: event.entity,
        entityId: event.entityId ?? null,
        metadata: event.metadata ?? null,
      },
    });
  }

  async list(companyId: string, limit = 100) {
    const logs = await this.db.auditLog.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });
    return logs.map((log) => ({
      ...log,
      metadata: typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata ?? null,
    }));
  }
}
