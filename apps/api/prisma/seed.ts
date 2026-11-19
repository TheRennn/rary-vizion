import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { Role } from '../src/common/domain-types';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hash('Demo@12345', 12);

  const company = await prisma.company.upsert({
    where: { slug: 'demo' },
    update: {},
    create: { id: '00000000-0000-4000-8000-000000000001', name: 'Demo Company', slug: 'demo' },
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
    { id: '10000000-0000-4000-8000-000000000001', name: 'Super Admin Demo', email: 'superadmin@demo.com', role: Role.SUPER_ADMIN, departmentId: mgmt.id, jobTitle: 'Super Administrator' },
    { id: '10000000-0000-4000-8000-000000000002', name: 'Owner Demo', email: 'owner@demo.com', role: Role.OWNER, departmentId: mgmt.id, jobTitle: 'CEO' },
    { id: '10000000-0000-4000-8000-000000000003', name: 'Admin Demo', email: 'admin@demo.com', role: Role.ADMIN, departmentId: mgmt.id, jobTitle: 'Administrator' },
    { id: '10000000-0000-4000-8000-000000000004', name: 'Manager Demo', email: 'manager@demo.com', role: Role.MANAGER, departmentId: mgmt.id, jobTitle: 'Engineering Manager' },
    { id: '10000000-0000-4000-8000-000000000005', name: 'Team Leader Demo', email: 'teamleader@demo.com', role: Role.TEAM_LEADER, departmentId: dev.id, jobTitle: 'Team Leader' },
    { id: '10000000-0000-4000-8000-000000000006', name: 'Developer Demo', email: 'developer@demo.com', role: Role.DEVELOPER, departmentId: dev.id, jobTitle: 'Backend Developer' },
    { id: '10000000-0000-4000-8000-000000000007', name: 'Dev Demo', email: 'dev@demo.com', role: Role.DEVELOPER, departmentId: dev.id, jobTitle: 'Backend Developer' },
    { id: '10000000-0000-4000-8000-000000000008', name: 'Guest Demo', email: 'guest@demo.com', role: Role.GUEST, departmentId: dev.id, jobTitle: 'Guest' },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, companyId: company.id, passwordHash },
    });
  }

  console.log('Seed ok. Contas demo: superadmin, owner, admin, manager, teamleader, developer e guest. Todos com senha Demo@12345');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
