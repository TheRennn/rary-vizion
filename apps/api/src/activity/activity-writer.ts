import { AuthUser } from '../common/auth-user';
import { SupabaseDataService } from '../supabase/supabase.service';

export interface ActivityInput {
  eventType: string;
  module: string;
  title: string;
  entityType: string;
  entityId: string;
  href: string;
  projectId?: string | null;
  targetUserId?: string | null;
}

/** Feed events contain only fixed summaries and resource links, never message/comment bodies. */
export async function recordActivity(db: SupabaseDataService, user: AuthUser, event: ActivityInput): Promise<void> {
  try {
    await db.activityEvent?.create({
      data: {
        companyId: user.companyId,
        actorId: user.id,
        eventType: event.eventType,
        module: event.module,
        title: event.title,
        entityType: event.entityType,
        entityId: event.entityId,
        projectId: event.projectId ?? null,
        targetUserId: event.targetUserId ?? null,
        href: event.href,
      },
    });
  } catch {
    // Business writes remain available before the additive Activity migration is deployed.
  }
}
