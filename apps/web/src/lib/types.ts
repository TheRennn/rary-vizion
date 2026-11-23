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

export interface AuditLog {
  id: string;
  companyId: string | null;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ChatPeer {
  id: string;
  name: string;
  email: string;
  jobTitle: string | null;
  active: boolean;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  sender: { id: string; name: string };
}

export interface ChatMessagePage {
  items: ChatMessage[];
  hasMore: boolean;
}

export interface ChatConversation {
  id: string;
  name: string | null;
  type: string;
  peer: ChatPeer | null;
  participants: ChatPeer[];
  updatedAt: string;
  lastMessage: ChatMessage | null;
  unread: boolean;
}

export type DashboardPeriod = '7d' | '30d' | '90d';

export interface DashboardTrendPoint {
  from: string;
  starts: number;
  ends: number;
  workedSeconds: number;
}

export interface DashboardOverview {
  generatedAt: string;
  period: DashboardPeriod;
  workforce: {
    activeEmployees: number;
    working: number;
    onBreak: number;
    offDuty: number;
    newEmployees: {
      current: number;
      previous: number;
      changePercent: number | null;
    };
    departments: Array<{
      id: string;
      name: string;
      employees: number;
      working: number;
      onBreak: number;
      offDuty: number;
      workedSeconds: number;
    }>;
  };
  attendance: {
    workedSeconds: number;
    previousWorkedSeconds: number;
    changePercent: number | null;
    averagePerActiveEmployeeSeconds: number;
    trend: DashboardTrendPoint[];
  };
  activity: Array<{
    id: string;
    description: string;
    actorName: string | null;
    createdAt: string;
  }>;
  projects: {
    active: number;
    total: number;
    byStatus: Record<string, number>;
    pendingTasks: number;
    overdueTasks: number;
    tasksByStatus: Record<string, number>;
    tasksByPriority: Record<string, number>;
  };
  upcomingMeetings: Array<{ id: string; name: string; startsAt: string; durationMinutes: number; code: string }>;
  upcomingMeetingsCount: number;
  unreadNotifications: number;
  availability: {
    projects: boolean;
    tasks: boolean;
    meetings: boolean;
    intelligence: boolean;
  };
}
