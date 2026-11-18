import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { Role } from '../src/common/domain-types';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hash('Demo@12345', 12);

  const company = await prisma.company.upsert({
    where: { slug: 'demo' },
    update: {},
    create: { name: 'Demo Company', slug: 'demo' },
  });

  const [dev, mgmt] = await Promise.all(
    ['Development', 'Management'].map((name) =>
      prisma.department.upsert({
        where: { companyId_name: { companyId: company.id, name } },
        update: {},
        create: { companyId: company.id, name },
      }),
    ),
  );

  const users = [
    { name: 'Owner Demo', email: 'owner@demo.com', role: Role.OWNER, departmentId: mgmt.id, jobTitle: 'CEO' },
    { name: 'Manager Demo', email: 'manager@demo.com', role: Role.MANAGER, departmentId: mgmt.id, jobTitle: 'Engineering Manager' },
    { name: 'Dev Demo', email: 'dev@demo.com', role: Role.DEVELOPER, departmentId: dev.id, jobTitle: 'Backend Developer' },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, companyId: company.id, passwordHash },
    });
  }

  console.log('Seed ok. Login: owner@demo.com / manager@demo.com / dev@demo.com  (senha: Demo@12345)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
