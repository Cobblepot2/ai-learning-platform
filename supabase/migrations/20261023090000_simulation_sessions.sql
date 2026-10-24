-- Server-authoritative state for AI-designed simulations. The browser may read
-- its own session for refresh/resume, but only the service-role server writes
-- state after checking the current stage, action and activity snapshot.
begin;

create table if not exists public.simulation_sessions (
  id uuid primary key,
  -- New value on every restart. learning_attempts.id uses this, not the session id,
  -- so a later run is stored even when the first run already wrote a row.
  run_id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id text not null,
  lesson_id text not null,
  activity_id text not null,
  course_revision integer not null default 0,
  activity_snapshot jsonb not null,
  state jsonb not null,
  history jsonb not null default '[]'::jsonb,
  step_count integer not null default 0 check (step_count >= 0),
  status text not null default 'active' check (status in ('active', 'completed')),
  outcome text check (outcome in ('success', 'partial', 'failure', 'incomplete')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id, lesson_id, activity_id),
  unique (run_id)
);

create index if not exists simulation_sessions_user_idx
  on public.simulation_sessions (user_id, course_id);

alter table public.simulation_sessions enable row level security;
revoke all on public.simulation_sessions from anon, authenticated;
grant select on public.simulation_sessions to authenticated;
grant all on public.simulation_sessions to service_role;

drop policy if exists "simulation sessions: own rows" on public.simulation_sessions;
create policy "simulation sessions: own rows"
  on public.simulation_sessions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

commit;
