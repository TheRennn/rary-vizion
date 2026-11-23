import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { SessionAuthGuard, RolesGuard, PermissionGuard } from './common/guards';
import { validateEnv } from './config/env';
import { DashboardModule } from './dashboard/dashboard.module';
import { DepartmentsModule } from './departments/departments.module';
import { HealthModule } from './health/health.module';
import { SupabaseModule } from './supabase/supabase.module';
import { TimeModule } from './time/time.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { MeetingsModule } from './meetings/meetings.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PermissionsModule } from './auth/permissions.module';
import { RateLimitModule } from './common/rate-limit.module';
import { SearchModule } from './search/search.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { CalendarModule } from './calendar/calendar.module';
import { ActivityModule } from './activity/activity.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: process.env.VIZION_API_ENV_FILE || '.env', validate: validateEnv }),
    RateLimitModule,
    SupabaseModule,
    AuditModule,
    AuthModule,
    PermissionsModule,
    ChatModule,
    DashboardModule,
    UsersModule,
    DepartmentsModule,
    TimeModule,
    HealthModule,
    ProjectsModule,
    MeetingsModule,
    NotificationsModule,
    SearchModule,
    WorkspaceModule,
    CalendarModule,
    ActivityModule,
  ],
  providers: [
    // Ordem importa: autentica primeiro, depois valida papel.
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
})
export class AppModule {}
