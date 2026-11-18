import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { Role } from '../common/domain-types';
import { CurrentUser, MinRole } from '../common/decorators';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/department.dto';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.departments.list(user.companyId);
  }

  @Post()
  @MinRole(Role.ADMIN)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDepartmentDto) {
    return this.departments.create(user, dto);
  }
}
