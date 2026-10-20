-- Initial schema: learner profiles, lesson progress and activity events.
-- Run in the Supabase SQL editor (or `supabase db push`).

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role text not null default 'student' check (role in ('student', 'instructor', 'admin')),
  background text,          -- non_cs | cs_student | cs_graduate | career_switcher
  experience text,          -- none | some | comfortable
  goal text,                -- understand | build | career
  language text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lesson_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id text not null,
  lesson_id text not null,
  completed_at timestamptz,
  block_results jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id, lesson_id)
);

-- Fine-grained engagement log, used later by the instructor dashboard.
create table if not exists public.activity_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id text not null,
  lesson_id text,
  block_id text,
  event_type text not null,  -- block_completed | tutor_message | roleplay_turn | ...
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_events_course_idx on public.activity_events (course_id, created_at);

alter table public.profiles enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.activity_events enable row level security;

create policy "profiles: own row" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "progress: own rows" on public.lesson_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "events: insert own" on public.activity_events
  for insert with check (auth.uid() = user_id);

create policy "events: read own" on public.activity_events
  for select using (auth.uid() = user_id);

-- Create an empty profile row when a user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
