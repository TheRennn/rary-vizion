import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/auth-user';
import { ROLE_RANK } from '../common/roles';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/user.dto';

const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  jobTitle: true,
  active: true,
  createdAt: true,
  department: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  list(companyId: string) {
    return this.prisma.user.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      select: PUBLIC_USER_SELECT,
    });
  }

  async create(actor: AuthUser, dto: CreateUserDto) {
    // Ninguém cria um usuário com autoridade igual ou superior à própria (evita escalonamento).
    if (ROLE_RANK[dto.role] >= ROLE_RANK[actor.role]) {
      throw new ForbiddenException('Você não pode criar um usuário com esse papel');
    }

    if (dto.departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, companyId: actor.companyId },
        select: { id: true },
      });
      if (!department) throw new BadRequestException('Departamento inválido');
    }

    const exists = await this.prisma.user.findUnique({ where: { email: dto.email }, select: { id: true } });
    if (exists) throw new ConflictException('E-mail já cadastrado');

    try {
      const user = await this.prisma.user.create({
        data: {
          companyId: actor.companyId,
          name: dto.name.trim(),
          email: dto.email,
          passwordHash: await hash(dto.password, 12),
          role: dto.role,
          departmentId: dto.departmentId,
          jobTitle: dto.jobTitle?.trim() || null,
        },
        select: PUBLIC_USER_SELECT,
      });

      await this.audit.log({
        companyId: actor.companyId,
        actorId: actor.id,
        action: 'user.created',
        entity: 'User',
        entityId: user.id,
        metadata: { email: user.email, role: user.role },
      });
      return user;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('E-mail já cadastrado');
      }
      throw e;
    }
  }
}
