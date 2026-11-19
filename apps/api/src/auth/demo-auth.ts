import { createHmac, timingSafeEqual } from 'crypto';
import { AuthUser } from '../common/auth-user';
import { Role } from '../common/domain-types';

export const DEMO_PASSWORD = 'Demo@12345';
export const DEMO_COMPANY_ID = '00000000-0000-4000-8000-000000000001';
export const DEMO_DEPARTMENT_IDS = {
  MANAGEMENT: '00000000-0000-4000-8000-000000000011',
  DEVELOPMENT: '00000000-0000-4000-8000-000000000012',
  OPERATIONS: '00000000-0000-4000-8000-000000000013',
};

const DEMO_ACCOUNTS: Array<{
  id: string;
  email: string;
  name: string;
  role: Role;
  jobTitle: string;
  departmentId: string;
}> = [
  { id: '10000000-0000-4000-8000-000000000001', email: 'superadmin@demo.com', name: 'Super Admin Demo', role: Role.SUPER_ADMIN, jobTitle: 'Super Administrator', departmentId: DEMO_DEPARTMENT_IDS.MANAGEMENT },
  { id: '10000000-0000-4000-8000-000000000002', email: 'owner@demo.com', name: 'Owner Demo', role: Role.OWNER, jobTitle: 'CEO', departmentId: DEMO_DEPARTMENT_IDS.MANAGEMENT },
  { id: '10000000-0000-4000-8000-000000000003', email: 'admin@demo.com', name: 'Admin Demo', role: Role.ADMIN, jobTitle: 'Administrator', departmentId: DEMO_DEPARTMENT_IDS.MANAGEMENT },
  { id: '10000000-0000-4000-8000-000000000004', email: 'manager@demo.com', name: 'Manager Demo', role: Role.MANAGER, jobTitle: 'Engineering Manager', departmentId: DEMO_DEPARTMENT_IDS.MANAGEMENT },
  { id: '10000000-0000-4000-8000-000000000005', email: 'teamleader@demo.com', name: 'Team Leader Demo', role: Role.TEAM_LEADER, jobTitle: 'Team Leader', departmentId: DEMO_DEPARTMENT_IDS.DEVELOPMENT },
  { id: '10000000-0000-4000-8000-000000000006', email: 'developer@demo.com', name: 'Developer Demo', role: Role.DEVELOPER, jobTitle: 'Backend Developer', departmentId: DEMO_DEPARTMENT_IDS.DEVELOPMENT },
  { id: '10000000-0000-4000-8000-000000000007', email: 'dev@demo.com', name: 'Dev Demo', role: Role.DEVELOPER, jobTitle: 'Backend Developer', departmentId: DEMO_DEPARTMENT_IDS.DEVELOPMENT },
  { id: '10000000-0000-4000-8000-000000000008', email: 'guest@demo.com', name: 'Guest Demo', role: Role.GUEST, jobTitle: 'Guest', departmentId: DEMO_DEPARTMENT_IDS.OPERATIONS },
];

export interface DemoAuthUser extends AuthUser {
  jobTitle: string | null;
  department: { id: string; name: string } | null;
  company: { id: string; name: string };
}

export function getDemoAccount(email: string) {
  return DEMO_ACCOUNTS.find((account) => account.email === email.trim().toLowerCase());
}

export function isDemoLogin(email: string, password: string): boolean {
  return !!getDemoAccount(email) && password === DEMO_PASSWORD;
}

export function demoUser(account: (typeof DEMO_ACCOUNTS)[number]): DemoAuthUser {
  const departmentNames: Record<string, string> = {
    [DEMO_DEPARTMENT_IDS.MANAGEMENT]: 'Management',
    [DEMO_DEPARTMENT_IDS.DEVELOPMENT]: 'Development',
    [DEMO_DEPARTMENT_IDS.OPERATIONS]: 'Operations',
  };
  return {
    id: account.id,
    companyId: DEMO_COMPANY_ID,
    role: account.role,
    name: account.name,
    email: account.email,
    jobTitle: account.jobTitle,
    company: { id: DEMO_COMPANY_ID, name: 'Demo Company' },
    department: { id: account.departmentId, name: departmentNames[account.departmentId] },
  };
}

function encode(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function createDemoToken(email: string, secret: string): string {
  const payload = encode({ demo: true, email: email.toLowerCase(), exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8 });
  const signature = createHmac('sha256', secret).update(payload).digest();
  return `demo.${payload}.${signature.toString('base64url')}`;
}

export function readDemoToken(token: string, secret: string): DemoAuthUser | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'demo') return null;

  const payload = parts[1];
  const actual = Buffer.from(parts[2], 'base64url');
  const expected = createHmac('sha256', secret).update(payload).digest();
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { demo?: boolean; email?: string; exp?: number };
    if (!data.demo || !data.email || !data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    const account = getDemoAccount(data.email);
    return account ? demoUser(account) : null;
  } catch {
    return null;
  }
}
