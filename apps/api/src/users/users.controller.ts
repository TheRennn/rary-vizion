import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { Role } from '../common/domain-types';
import { CurrentUser, MinRole, RequirePermission } from '../common/decorators';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermission('workforce', 'view')
  list(@CurrentUser() user: AuthUser) {
    return this.users.list(user.companyId);
  }

  @Post()
  @MinRole(Role.ADMIN)
  @RequirePermission('workforce', 'create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    return this.users.create(user, dto);
  }

  @Patch(':id')
  @MinRole(Role.ADMIN)
  @RequirePermission('workforce', 'edit')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(user, id, dto);
  }

  @Delete(':id/sessions')
  @MinRole(Role.ADMIN)
  @RequirePermission('workforce', 'manage')
  revokeSessions(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.revokeSessions(user, id);
  }
}
