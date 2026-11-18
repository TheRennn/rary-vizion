import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

  async log(event: AuditEvent): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        companyId: event.companyId ?? null,
        actorId: event.actorId ?? null,
        action: event.action,
        entity: event.entity,
        entityId: event.entityId ?? null,
        metadata: event.metadata ? JSON.stringify(event.metadata) : null,
      },
    });
  }

  async list(companyId: string, limit = 100) {
    const logs = await this.prisma.auditLog.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });
    return logs.map((log) => ({
      ...log,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
    }));
  }
}
