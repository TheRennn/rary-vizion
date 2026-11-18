export type Role = 'SUPER_ADMIN' | 'OWNER' | 'ADMIN' | 'MANAGER' | 'TEAM_LEADER' | 'DEVELOPER' | 'GUEST';
export type TimeEntryType = 'CLOCK_IN' | 'BREAK_START' | 'BREAK_END' | 'CLOCK_OUT';
export type PresenceStatus = 'OFFLINE' | 'WORKING' | 'ON_BREAK';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  jobTitle: string | null;
  company: { id: string; name: string };
  department: { id: string; name: string } | null;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: Role;
  jobTitle: string | null;
  active: boolean;
  department: { id: string; name: string } | null;
}

export interface Department {
  id: string;
  name: string;
  _count: { users: number };
}

export interface TimeEntry {
  id: string;
  type: TimeEntryType;
  recordedAt: string;
  note: string | null;
}

export interface TodayResponse {
  status: PresenceStatus;
  since: string | null;
  workedSeconds: number;
  entries: TimeEntry[];
  serverTime: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: Role;
  jobTitle: string | null;
  department: { id: string; name: string } | null;
  status: PresenceStatus;
  since: string | null;
}
