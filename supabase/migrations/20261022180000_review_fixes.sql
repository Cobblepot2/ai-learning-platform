-- Review fixes 4–8. Apply after 20261022050613_general_learning_platform.sql.
-- 4. Stricter course-document shape (lesson/activity structure, known types, unique ids).
-- 5. Shared hourly AI quota. The app also keeps a per-process memory limit.
-- 6. Enrolment rows are created only by claim_course_invitations (and service role
--    for a learner joining a public course). Teachers cannot insert an arbitrary user id.
-- 7. Students cannot insert, update or delete lesson_progress for database course ids.
-- 8. learning_attempts are not cascade-deleted with a course. Archive instead.
begin;

-- 8. Archive is a third status. Learners keep attempts; the catalogue hides the course.
do $$
declare r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'courses'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table public.courses drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.courses
  add constraint courses_status_check
  check (status in ('draft', 'published', 'archived'));

-- 4. Structural validation. Zod remains stricter on field lengths and answer indexes.
-- Known activity types must stay in step with src/lib/learning/registry.ts.
create or replace function private.course_document_ok(course_id uuid, doc jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  lesson jsonb;
  block jsonb;
  ids text[] := array[]::text[];
  lid text;
  bid text;
begin
  if jsonb_typeof(doc) <> 'object' then return false; end if;
  if doc->>'id' is distinct from course_id::text then return false; end if;
  if jsonb_typeof(doc->'lessons') <> 'array' then return false; end if;
  if jsonb_array_length(doc->'lessons') > 30 then return false; end if;
  for lesson in select value from jsonb_array_elements(doc->'lessons')
  loop
    if jsonb_typeof(lesson) <> 'object' then return false; end if;
    lid := lesson->>'id';
    if lid is null or length(btrim(lid)) < 1 or length(lid) > 300 then return false; end if;
    if lid = any (ids) then return false; end if;
    ids := ids || lid;
    if jsonb_typeof(lesson->'blocks') <> 'array' then return false; end if;
    if jsonb_array_length(lesson->'blocks') > 40 then return false; end if;
    for block in select value from jsonb_array_elements(lesson->'blocks')
    loop
      if jsonb_typeof(block) <> 'object' then return false; end if;
      bid := block->>'id';
      if bid is null or length(btrim(bid)) < 1 or length(bid) > 300 then return false; end if;
      if bid = any (ids) then return false; end if;
      ids := ids || bid;
      if block->>'type' is distinct from 'activity' then return false; end if;
      if block->>'version' is distinct from '1' then return false; end if;
      if coalesce(block->>'activityType', '') not in
        ('reading', 'choice', 'response', 'quiz', 'ordering', 'conversation') then
        return false;
      end if;
      if jsonb_typeof(block->'config') <> 'object' then return false; end if;
    end loop;
  end loop;
  return true;
end;
$$;
revoke all on function private.course_document_ok(uuid, jsonb) from public;
grant execute on function private.course_document_ok(uuid, jsonb) to anon, authenticated, service_role;

alter table public.courses drop constraint if exists courses_document_check;
alter table public.courses
  add constraint courses_document_check
  check (private.course_document_ok(id, document));

-- 8. Deleting a course must not erase learner evidence.
alter table public.learning_attempts drop constraint if exists learning_attempts_course_id_fkey;
alter table public.learning_attempts
  add constraint learning_attempts_course_id_fkey
  foreign key (course_id) references public.courses (id) on delete restrict;

-- 6. Teachers already have DELETE for removal. INSERT of an arbitrary student is closed.
drop policy if exists enrolment_add on public.course_enrolments;
revoke insert on table public.course_enrolments from authenticated;

-- 7. The old restrictive policy used USING (true), so DELETE of a database course
-- still succeeded. Split insert, update and delete. Legacy non-uuid demos stay writable.
drop policy if exists dynamic_progress_write_guard on public.lesson_progress;
drop policy if exists dynamic_progress_no_insert on public.lesson_progress;
drop policy if exists dynamic_progress_no_update on public.lesson_progress;
drop policy if exists dynamic_progress_no_delete on public.lesson_progress;

create policy dynamic_progress_no_insert on public.lesson_progress
  as restrictive for insert to authenticated
  with check (course_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

create policy dynamic_progress_no_update on public.lesson_progress
  as restrictive for update to authenticated
  using (course_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  with check (course_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

create policy dynamic_progress_no_delete on public.lesson_progress
  as restrictive for delete to authenticated
  using (course_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

-- 5. Shared quota. Callers cannot widen the window or the cap: the function
-- rejects any window other than 3600 seconds and any cap above 100.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null check (bucket in ('generation', 'feedback', 'tutor', 'roleplay', 'prompt-lab')),
  window_start timestamptz not null,
  hits integer not null check (hits >= 0),
  primary key (user_id, bucket, window_start)
);
alter table public.ai_usage enable row level security;
revoke all on table public.ai_usage from anon, authenticated;
grant select on table public.ai_usage to authenticated;
drop policy if exists ai_usage_read_own on public.ai_usage;
create policy ai_usage_read_own on public.ai_usage
  for select to authenticated using (user_id = auth.uid());
grant all on table public.ai_usage to service_role;

create or replace function public.consume_ai_quota(bucket text, max_hits integer, window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  start_at timestamptz;
  current_hits integer;
begin
  if uid is null then
    raise exception 'Sign in required';
  end if;
  if bucket not in ('generation', 'feedback', 'tutor', 'roleplay', 'prompt-lab') then
    raise exception 'Unknown quota bucket';
  end if;
  if max_hits < 1 or max_hits > 100 or window_seconds <> 3600 then
    raise exception 'Invalid quota window';
  end if;
  start_at := to_timestamp(floor(extract(epoch from clock_timestamp()) / window_seconds) * window_seconds);
  insert into public.ai_usage as usage (user_id, bucket, window_start, hits)
  values (uid, bucket, start_at, 1)
  on conflict (user_id, bucket, window_start)
  do update set hits = usage.hits + 1
  returning hits into current_hits;
  return current_hits <= max_hits;
end;
$$;
revoke all on function public.consume_ai_quota(text, integer, integer) from public, anon;
grant execute on function public.consume_ai_quota(text, integer, integer) to authenticated;

commit;
