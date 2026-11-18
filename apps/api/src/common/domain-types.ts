export const Role = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  TEAM_LEADER: 'TEAM_LEADER',
  DEVELOPER: 'DEVELOPER',
  GUEST: 'GUEST',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const TimeEntryType = {
  CLOCK_IN: 'CLOCK_IN',
  BREAK_START: 'BREAK_START',
  BREAK_END: 'BREAK_END',
  CLOCK_OUT: 'CLOCK_OUT',
} as const;

export type TimeEntryType = (typeof TimeEntryType)[keyof typeof TimeEntryType];
