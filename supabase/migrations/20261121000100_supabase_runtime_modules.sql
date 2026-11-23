alter table public.users add column if not exists job_title text;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'PLANNING',
  owner_id uuid references public.users(id) on delete set null,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_company_updated_idx on public.projects(company_id, updated_at desc);

create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'TODO',
  priority text not null default 'MEDIUM',
  assignee_id uuid references public.users(id) on delete set null,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists project_tasks_project_status_idx on public.project_tasks(project_id, status);
create index if not exists project_tasks_assignee_idx on public.project_tasks(assignee_id);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  starts_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  access_mode text not null default 'TEAM',
  code text not null unique,
  created_by_id uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists meetings_company_starts_idx on public.meetings(company_id, starts_at);

create table if not exists public.meeting_participants (
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  joined_at timestamptz,
  primary key (meeting_id, user_id)
);
create index if not exists meeting_participants_user_idx on public.meeting_participants(user_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  body text not null,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_company_user_created_idx on public.notifications(company_id, user_id, created_at desc);

create table if not exists public.permission_grants (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  role text not null,
  module text not null,
  action text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (company_id, role, module, action)
);
create index if not exists permission_grants_company_role_idx on public.permission_grants(company_id, role);

alter table public.projects enable row level security;
alter table public.project_tasks enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_participants enable row level security;
alter table public.notifications enable row level security;
alter table public.permission_grants enable row level security;
grant all privileges on public.projects, public.project_tasks, public.meetings,
  public.meeting_participants, public.notifications, public.permission_grants to service_role;

-- Employee accounts are created only by the API's service key. Only app_metadata
-- is trusted for company membership; raw user metadata is supplied by the browser.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_company_id uuid;
  company_name text := coalesce(new.raw_user_meta_data->>'companyName', 'Minha Empresa');
  requested_company text := new.raw_app_meta_data->>'companyId';
  requested_role text := new.raw_app_meta_data->>'role';
  resolved_role text;
begin
  if requested_company is not null then
    select id into resolved_company_id from public.companies where id = requested_company::uuid;
    if resolved_company_id is null then raise exception 'Empresa informada não existe'; end if;
    resolved_role := case when requested_role in ('ADMIN','MANAGER','TEAM_LEADER','DEVELOPER','GUEST') then requested_role else 'DEVELOPER' end;
  else
    insert into public.companies(name, slug)
    values (company_name, lower(regexp_replace(company_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 8))
    returning id into resolved_company_id;
    resolved_role := 'OWNER';
  end if;

  insert into public.users(id, company_id, department_id, name, email, role, job_title, active)
  values (
    new.id,
    resolved_company_id,
    case when new.raw_user_meta_data->>'departmentId' ~* '^[0-9a-f-]{36}$' then (new.raw_user_meta_data->>'departmentId')::uuid else null end,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    resolved_role,
    new.raw_user_meta_data->>'jobTitle',
    true
  );
  return new;
end;
$$;

create or replace function public.record_time_entry(p_company_id uuid, p_user_id uuid, p_type text, p_note text default null)
returns public.time_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  last_type text;
  entry public.time_entries;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  if not exists (select 1 from public.users where id = p_user_id and company_id = p_company_id and active) then
    raise exception 'Usuário inválido ou inativo';
  end if;
  select type into last_type from public.time_entries where user_id = p_user_id order by recorded_at desc, id desc limit 1;
  if not (
    (last_type is null and p_type = 'CLOCK_IN') or
    (last_type = 'CLOCK_IN' and p_type = 'BREAK_START') or
    (last_type = 'BREAK_START' and p_type in ('BREAK_END','CLOCK_OUT')) or
    (last_type = 'BREAK_END' and p_type in ('BREAK_START','CLOCK_OUT')) or
    (last_type = 'CLOCK_OUT' and p_type = 'CLOCK_IN')
  ) then raise exception 'Registro não permitido no estado atual'; end if;
  insert into public.time_entries(company_id, user_id, type, note)
  values (p_company_id, p_user_id, p_type, p_note) returning * into entry;
  return entry;
end;
$$;
grant execute on function public.record_time_entry(uuid, uuid, text, text) to service_role;
