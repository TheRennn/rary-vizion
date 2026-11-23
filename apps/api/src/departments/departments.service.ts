import { ConflictException, Injectable } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/auth-user';
import { SupabaseDataService } from '../supabase/supabase.service';
import { CreateDepartmentDto } from './dto/department.dto';

@Injectable()
export class DepartmentsService {
  constructor(private readonly db: SupabaseDataService, private readonly audit: AuditService) {}

  list(companyId: string) {
    return this.db.department.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, _count: { select: { users: true } } },
    });
  }

  async create(actor: AuthUser, dto: CreateDepartmentDto) {
    try {
      const department = await this.db.department.create({
        data: { companyId: actor.companyId, name: dto.name.trim() },
        select: { id: true, name: true },
      });
      await this.audit.log({
        companyId: actor.companyId,
        actorId: actor.id,
        action: 'department.created',
        entity: 'Department',
        entityId: department.id,
        metadata: { name: department.name },
      });
      return department;
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2002') {
        throw new ConflictException('Já existe um departamento com esse nome');
      }
      throw e;
    }
  }
}
