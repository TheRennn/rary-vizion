import { Controller, Get } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { Role } from '../common/domain-types';
import { CurrentUser, MinRole, RequirePermission } from '../common/decorators';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @MinRole(Role.ADMIN)
  @RequirePermission('audit', 'view')
  list(@CurrentUser() user: AuthUser) {
    return this.audit.list(user.companyId);
  }
}
