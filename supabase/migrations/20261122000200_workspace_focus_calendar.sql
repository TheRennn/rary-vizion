-- Sprint 14 workspace preferences, focus sessions and calendar events.
create table if not exists public.workspace_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  layout jsonb not null default '{"order":[],"hidden":[]}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists workspace_preferences_company_idx on public.workspace_preferences(company_id);

create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  task_id uuid not null references public.project_tasks(id) on delete cascade,
  started_at timestamptz not null default now(),
  paused_at timestamptz,
  finished_at timestamptz,
  paused_seconds integer not null default 0 check (paused_seconds >= 0),
  status text not null default 'RUNNING' check (status in ('RUNNING','PAUSED','COMPLETED')),
  check ((status = 'RUNNING' and paused_at is null and finished_at is null) or (status = 'PAUSED' and paused_at is not null and finished_at is null) or (status = 'COMPLETED' and finished_at is not null and paused_at is null))
);
create unique index if not exists focus_sessions_one_active_per_user on public.focus_sessions(user_id) where status in ('RUNNING','PAUSED');
create index if not exists focus_sessions_user_started_idx on public.focus_sessions(company_id,user_id,started_at desc);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by_id uuid not null references public.users(id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  description text,
  category text not null default 'EVENT' check (category in ('EVENT','COMMITMENT')),
  access_mode text not null default 'TEAM' check (access_mode in ('TEAM','PRIVATE')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists calendar_events_company_start_idx on public.calendar_events(company_id,starts_at);
alter table public.workspace_preferences enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.calendar_events enable row level security;
grant all privileges on public.workspace_preferences, public.focus_sessions, public.calendar_events to service_role;
