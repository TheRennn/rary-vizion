import { Body, Controller, Get, Patch } from '@nestjs/common';
import { IsBoolean, IsIn, IsString } from 'class-validator';
import { AuthUser } from '../common/auth-user';
import { CurrentUser, MinRole } from '../common/decorators';
import { Role } from '../common/domain-types';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from '../common/permissions';
import { PermissionsService } from './permissions.service';

class UpdatePermissionDto {
  @IsString() @IsIn(Object.values(Role)) role!: Role;
  @IsString() @IsIn(PERMISSION_MODULES) module!: (typeof PERMISSION_MODULES)[number];
  @IsString() @IsIn(PERMISSION_ACTIONS) action!: (typeof PERMISSION_ACTIONS)[number];
  @IsBoolean() enabled!: boolean;
}

@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get('me')
  current(@CurrentUser() user: AuthUser) {
    return this.permissions.current(user);
  }

  @Get()
  @MinRole(Role.OWNER)
  matrix(@CurrentUser() user: AuthUser) {
    return this.permissions.matrix(user.companyId);
  }

  @Patch()
  @MinRole(Role.OWNER)
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdatePermissionDto) {
    return this.permissions.set(user, dto.role, dto.module, dto.action, dto.enabled);
  }
}
