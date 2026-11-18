import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { Role } from '../common/domain-types';
import { compare, hash } from 'bcryptjs';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

const BCRYPT_ROUNDS = 12;

function slugify(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${base || 'company'}-${randomBytes(2).toString('hex')}`;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<{ accessToken: string }> {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email }, select: { id: true } });
    if (exists) throw new ConflictException('E-mail já cadastrado');

    const passwordHash = await hash(dto.password, BCRYPT_ROUNDS);

    try {
      const { company, user } = await this.prisma.$transaction(async (tx) => {
        const company = await tx.company.create({ data: { name: dto.companyName, slug: slugify(dto.companyName) } });
        const user = await tx.user.create({
          data: { companyId: company.id, name: dto.name, email: dto.email, passwordHash, role: Role.OWNER },
        });
        return { company, user };
      });

      await this.audit.log({
        companyId: company.id,
        actorId: user.id,
        action: 'company.registered',
        entity: 'Company',
        entityId: company.id,
      });

      return { accessToken: await this.signToken(user.id, company.id, user.role) };
    } catch (e) {
      // Corrida entre dois cadastros com o mesmo e-mail.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('E-mail já cadastrado');
      }
      throw e;
    }
  }

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const valid = user ? await compare(dto.password, user.passwordHash) : false;

    // Mesma mensagem para e-mail inexistente, senha errada ou conta inativa.
    if (!user || !valid || !user.active) throw new UnauthorizedException('Credenciais inválidas');

    await this.audit.log({ companyId: user.companyId, actorId: user.id, action: 'auth.login', entity: 'User', entityId: user.id });
    return { accessToken: await this.signToken(user.id, user.companyId, user.role) };
  }

  /**
   * Atalho SOMENTE para desenvolvimento: entra como o owner da empresa demo.
   * Pode ser desativado com DEV_AUTO_LOGIN=false e é bloqueado em NODE_ENV=production.
   */
  async devLogin(): Promise<{ accessToken: string }> {
    const enabled = this.config.get<string>('DEV_AUTO_LOGIN') !== 'false';
    if (!enabled || this.config.get<string>('NODE_ENV') === 'production') throw new NotFoundException();

    let user = await this.prisma.user.findUnique({ where: { email: 'owner@demo.com' } });
    if (!user) {
      const company = await this.prisma.company.upsert({
        where: { slug: 'demo' },
        update: {},
        create: { name: 'Demo Company', slug: 'demo' },
      });
      user = await this.prisma.user.create({
        data: {
          companyId: company.id,
          name: 'Owner Demo',
          email: 'owner@demo.com',
          passwordHash: await hash(randomBytes(16).toString('hex'), BCRYPT_ROUNDS),
          role: Role.OWNER,
          jobTitle: 'CEO',
        },
      });
    }
    if (!user.active) throw new UnauthorizedException('Usuário demo desativado');
    return { accessToken: await this.signToken(user.id, user.companyId, user.role) };
  }

  me(authUser: AuthUser) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: authUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        jobTitle: true,
        company: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });
  }

  private signToken(userId: string, companyId: string, role: string): Promise<string> {
    return this.jwt.signAsync({ sub: userId, companyId, role });
  }
}
