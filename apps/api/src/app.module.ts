import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { JwtAuthGuard, RolesGuard } from './common/guards';
import { validateEnv } from './config/env';
import { DashboardModule } from './dashboard/dashboard.module';
import { DepartmentsModule } from './departments/departments.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { TimeModule } from './time/time.module';
import { UsersModule } from './users/users.module';
import { SupabaseModule } from './supabase/supabase.module';
import { SupabaseAuthGuard } from './common/guards';
import { ProjectsModule } from './projects/projects.module';
import { MeetingsModule } from './meetings/meetings.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    SupabaseModule,
    PrismaModule,
    AuditModule,
    AuthModule,
    ChatModule,
    DashboardModule,
    UsersModule,
    DepartmentsModule,
    TimeModule,
    HealthModule,
    ProjectsModule,
    MeetingsModule,
    NotificationsModule,
  ],
  providers: [
    // Ordem importa: autentica primeiro, depois valida papel.
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
