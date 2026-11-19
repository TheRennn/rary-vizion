import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { Role } from '../common/domain-types';
import { CurrentUser, MinRole } from '../common/decorators';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.users.list(user.companyId);
  }

  @Post()
  @MinRole(Role.ADMIN)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    return this.users.create(user, dto);
  }

  @Patch(':id')
  @MinRole(Role.ADMIN)
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(user, id, dto);
  }
}
