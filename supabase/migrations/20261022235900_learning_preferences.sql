-- Global learning preferences and optional course-level learner context.
-- Existing background/experience columns are intentionally preserved.

alter table public.profiles
  add column if not exists learning_style text;

-- The earlier migration granted column-level write access. Re-grant the full
-- set so the new preference column can be written without widening other
-- columns (role remains protected by its trigger and policies).
grant update (display_name, background, experience, goal, language, learning_style, updated_at)
  on public.profiles to authenticated;
grant insert (id, display_name, background, experience, goal, language, learning_style, updated_at)
  on public.profiles to authenticated;

create table if not exists public.course_learner_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id text not null,
  experience text not null check (experience in ('none', 'some', 'comfortable')),
  goal text not null check (goal in ('understand', 'build', 'career')),
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

alter table public.course_learner_preferences enable row level security;
revoke all on public.course_learner_preferences from anon, authenticated;
grant select, insert, update, delete on public.course_learner_preferences to authenticated;

drop policy if exists "course preferences: own rows" on public.course_learner_preferences;
create policy "course preferences: own rows"
  on public.course_learner_preferences
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
