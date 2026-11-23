-- Projects 3.0 additive schema. Apply explicitly in the Supabase SQL Editor.
alter table public.project_tasks
  add column if not exists created_by_id uuid references public.users(id) on delete set null,
  add column if not exists parent_task_id uuid references public.project_tasks(id) on delete cascade,
  add column if not exists labels text[] not null default '{}';

create index if not exists project_tasks_parent_idx on public.project_tasks(parent_task_id);
create index if not exists project_tasks_due_idx on public.project_tasks(due_at) where due_at is not null;

create table if not exists public.project_task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.project_tasks(id) on delete cascade,
  author_id uuid not null references public.users(id) on delete restrict,
  body text not null check (length(body) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists project_task_comments_task_created_idx on public.project_task_comments(task_id, created_at);

create table if not exists public.project_task_dependencies (
  task_id uuid not null references public.project_tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.project_tasks(id) on delete cascade,
  created_by_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);
create index if not exists project_task_dependencies_target_idx on public.project_task_dependencies(depends_on_task_id);

alter table public.project_task_comments enable row level security;
alter table public.project_task_dependencies enable row level security;
grant all privileges on public.project_task_comments, public.project_task_dependencies to service_role;
