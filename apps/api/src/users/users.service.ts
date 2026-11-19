import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/auth-user';
import { ROLE_RANK } from '../common/roles';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

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

  async update(actor: AuthUser, userId: string, dto: UpdateUserDto) {
    if (Object.keys(dto).length === 0) throw new BadRequestException('Informe ao menos um campo para atualizar');

    const current = await this.prisma.user.findFirst({
      where: { id: userId, companyId: actor.companyId },
      select: { id: true, role: true, active: true },
    });
    if (!current) throw new NotFoundException('Colaborador não encontrado');

    if (!Object.prototype.hasOwnProperty.call(ROLE_RANK, current.role) || ROLE_RANK[current.role as keyof typeof ROLE_RANK] >= ROLE_RANK[actor.role]) {
      throw new ForbiddenException('Você não pode alterar um usuário com papel igual ou superior ao seu');
    }
    if (dto.role && ROLE_RANK[dto.role] >= ROLE_RANK[actor.role]) {
      throw new ForbiddenException('Você não pode atribuir um papel igual ou superior ao seu');
    }
    if (userId === actor.id && dto.active === false) {
      throw new BadRequestException('Você não pode arquivar a própria conta');
    }
    if (dto.departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, companyId: actor.companyId },
        select: { id: true },
      });
      if (!department) throw new BadRequestException('Departamento inválido');
    }

    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.jobTitle !== undefined) data.jobTitle = dto.jobTitle?.trim() || null;
    if (Object.prototype.hasOwnProperty.call(dto, 'departmentId')) {
      data.department = dto.departmentId
        ? { connect: { id: dto.departmentId } }
        : { disconnect: true };
    }
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.active !== undefined) data.active = dto.active;

    const user = await this.prisma.user.update({ where: { id: userId }, data, select: PUBLIC_USER_SELECT });
    await this.audit.log({
      companyId: actor.companyId,
      actorId: actor.id,
      action: dto.active === false ? 'user.archived' : dto.active === true && !current.active ? 'user.reactivated' : 'user.updated',
      entity: 'User',
      entityId: user.id,
      metadata: { changedFields: Object.keys(dto) },
    });
    return user;
  }
}
