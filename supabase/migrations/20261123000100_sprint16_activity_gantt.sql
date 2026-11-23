-- Activity Center stores compact, non-sensitive event summaries. Private resources
-- are scoped to a single recipient; event payloads never copy chat/comment bodies.
create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_id uuid references public.users(id) on delete set null,
  event_type text not null check (event_type in (
    'project.created', 'task.assigned', 'task.completed', 'comment.created',
    'meeting.scheduled', 'calendar.created', 'admin.changed'
  )),
  module text not null check (module in ('projects', 'meetings', 'calendar', 'settings')),
  title text not null check (length(title) between 1 and 160),
  entity_type text not null,
  entity_id uuid not null,
  project_id uuid references public.projects(id) on delete set null,
  target_user_id uuid references public.users(id) on delete cascade,
  href text not null check (href ~ '^/[a-zA-Z0-9/_?=&-]*$'),
  created_at timestamptz not null default now()
);
create index if not exists activity_events_company_created_idx
  on public.activity_events(company_id, created_at desc, id desc);
create index if not exists activity_events_company_module_created_idx
  on public.activity_events(company_id, module, created_at desc, id desc);
create index if not exists activity_events_company_project_created_idx
  on public.activity_events(company_id, project_id, created_at desc, id desc)
  where project_id is not null;
create index if not exists activity_events_recipient_created_idx
  on public.activity_events(company_id, target_user_id, created_at desc, id desc)
  where target_user_id is not null;

alter table public.activity_events enable row level security;
drop policy if exists activity_events_read_scoped on public.activity_events;
create policy activity_events_read_scoped on public.activity_events
  for select using (
    company_id = (select company_id from public.users where id = auth.uid() and active)
    and (target_user_id is null or target_user_id = auth.uid())
  );
grant select, insert, update, delete on public.activity_events to service_role;

alter table public.project_tasks
  add column if not exists starts_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists is_milestone boolean not null default false;
create index if not exists project_tasks_project_schedule_idx
  on public.project_tasks(project_id, starts_at, due_at);
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.project_tasks'::regclass
      and conname = 'project_tasks_schedule_order_check'
  ) then
    alter table public.project_tasks
      add constraint project_tasks_schedule_order_check
      check (starts_at is null or due_at is null or starts_at <= due_at) not valid;
  end if;
end;
$$;
alter table public.project_tasks validate constraint project_tasks_schedule_order_check;
