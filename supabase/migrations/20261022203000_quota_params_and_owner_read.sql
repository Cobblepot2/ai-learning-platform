-- Quota parameter names and owner-visible course reads.
-- Apply after 20261022180000_review_fixes.sql. Safe to re-run: the function is
-- dropped and recreated, and the course read policy is replaced.
--
-- consume_ai_quota(bucket, ...) failed with 42702 because the parameter name
-- matched ai_usage.bucket inside ON CONFLICT. The replacement uses p_bucket and
-- ON CONFLICT ON CONSTRAINT so PostgREST sees a single (text, integer, integer)
-- function.
--
-- course_read used only private.can_learn(id). That stable definer reads
-- public.courses and cannot see the row being inserted, so INSERT/UPDATE
-- ... RETURNING failed the SELECT policy (42501) for the owner. Owners match
-- owner_id directly; everyone else still goes through can_learn.
--
-- Other insert/update ... returning paths were checked against the same snapshot
-- rule. course_invitations, profiles, lesson_progress and activity_events either
-- compare auth.uid() to a column on the new row, or call a helper that reads a
-- different table that already exists. course_enrolments and learning_attempts
-- are not inserted by authenticated. No policy change there.

begin;

drop function if exists public.consume_ai_quota(text, integer, integer);

create function public.consume_ai_quota(p_bucket text, max_hits integer, window_seconds integer)
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
  if p_bucket not in ('generation', 'feedback', 'tutor', 'roleplay', 'prompt-lab') then
    raise exception 'Unknown quota bucket';
  end if;
  if max_hits < 1 or max_hits > 100 or window_seconds <> 3600 then
    raise exception 'Invalid quota window';
  end if;
  start_at := to_timestamp(floor(extract(epoch from clock_timestamp()) / window_seconds) * window_seconds);
  insert into public.ai_usage as usage (user_id, bucket, window_start, hits)
  values (uid, p_bucket, start_at, 1)
  on conflict on constraint ai_usage_pkey
  do update set hits = usage.hits + 1
  returning usage.hits into current_hits;
  return current_hits <= max_hits;
end;
$$;

revoke all on function public.consume_ai_quota(text, integer, integer) from public, anon;
grant execute on function public.consume_ai_quota(text, integer, integer) to authenticated;

drop policy if exists course_read on public.courses;
create policy course_read on public.courses
  for select
  using (owner_id = auth.uid() or private.can_learn(id));

commit;
