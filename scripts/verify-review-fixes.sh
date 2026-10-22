#!/usr/bin/env bash
# Apply the Supabase migrations to plain Postgres and run the review reproductions.
#
# Usage (from the repo root):
#   bash scripts/verify-review-fixes.sh
#   npm run test:postgres
#
# Needs a local Postgres superuser. Peer auth via `sudo -u postgres` is used
# when the current user cannot create databases. The script builds two
# databases: one with the three earlier migrations (the reported failures, then
# the new migration applied and re-applied) and one fresh database with all
# four migrations in order.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SHIM="$ROOT/scripts/pg-auth-shim.sql"
MIG_DIR="$ROOT/supabase/migrations"
MIG1="$MIG_DIR/0001_init.sql"
MIG2="$MIG_DIR/20261022050613_general_learning_platform.sql"
MIG3="$MIG_DIR/20261022180000_review_fixes.sql"
MIG4="$MIG_DIR/20261022203000_quota_params_and_owner_read.sql"

OWNER="11111111-1111-4111-8111-111111111111"
OTHER="33333333-3333-4333-8333-333333333333"
SUFFIX="$$"
FRESH="review_fixes_fresh_${SUFFIX}"
EXISTING="review_fixes_existing_${SUFFIX}"

if sudo -u postgres psql -d postgres -c "select 1" >/dev/null 2>&1; then
  pq() { sudo -u postgres "$@"; }
elif psql -d postgres -c "select 1" >/dev/null 2>&1; then
  pq() { "$@"; }
else
  echo "Cannot connect to Postgres as the current user or as postgres." >&2
  exit 1
fi

cleanup() {
  pq dropdb --if-exists "$FRESH" >/dev/null 2>&1 || true
  pq dropdb --if-exists "$EXISTING" >/dev/null 2>&1 || true
}
trap cleanup EXIT

psql_db() {
  local db="$1"
  shift
  pq psql -d "$db" -v ON_ERROR_STOP=1 -q "$@"
}

apply_base() {
  local db="$1"
  psql_db "$db" -f "$SHIM" >/dev/null
  psql_db "$db" -f "$MIG1" >/dev/null
  psql_db "$db" -f "$MIG2" >/dev/null
  psql_db "$db" -f "$MIG3" >/dev/null
}

seed_users() {
  local db="$1"
  psql_db "$db" <<SQL
insert into auth.users (id, email, email_confirmed_at) values
  ('${OWNER}', 'owner@example.test', now()),
  ('${OTHER}', 'other@example.test', now());
update public.profiles set role = 'instructor' where id = '${OWNER}';
SQL
}

# Failures that the three earlier migrations still have.
expect_old_failures() {
  local db="$1"
  echo "Expecting 42702 and 42501 on ${db} before the new migration"
  psql_db "$db" <<SQL
begin;
select set_config('request.jwt.claims', json_build_object('sub', '${OWNER}', 'role', 'authenticated')::text, true);
set local role authenticated;
do \$check\$
begin
  perform public.consume_ai_quota('tutor', 60, 3600);
  raise exception 'consume_ai_quota unexpectedly succeeded';
exception
  when ambiguous_column then
    if sqlstate <> '42702' then
      raise exception 'quota sqlstate %, expected 42702', sqlstate;
    end if;
end
\$check\$;

do \$check\$
begin
  insert into public.courses (id, owner_id, document)
  values (
    '22222222-2222-2222-2222-222222222222',
    auth.uid(),
    '{"id":"22222222-2222-2222-2222-222222222222","lessons":[]}'::jsonb
  );
end
\$check\$;

do \$check\$
declare
  got uuid;
begin
  insert into public.courses (id, owner_id, document)
  values (
    '44444444-4444-4444-8444-444444444444',
    auth.uid(),
    '{"id":"44444444-4444-4444-8444-444444444444","lessons":[]}'::jsonb
  )
  returning id into got;
  raise exception 'insert returning unexpectedly succeeded';
exception
  when insufficient_privilege then
    if sqlstate <> '42501' then
      raise exception 'insert sqlstate %, expected 42501', sqlstate;
    end if;
end
\$check\$;
rollback;
SQL
}

assert_fixed() {
  local db="$1"
  echo "Checking quota, owner insert returning, and private-course hiding on ${db}" >&2
  psql_db "$db" <<SQL
begin;
select set_config('request.jwt.claims', json_build_object('sub', '${OWNER}', 'role', 'authenticated')::text, true);
set local role authenticated;
do \$check\$
declare
  first boolean;
  second boolean;
  n integer;
  cid uuid := '22222222-2222-2222-2222-222222222222';
  got uuid;
  email_got text;
begin
  select public.consume_ai_quota('tutor', 60, 3600) into first;
  select public.consume_ai_quota('tutor', 60, 3600) into second;
  if first is not true or second is not true then
    raise exception 'expected two successful tutor quota calls, got % then %', first, second;
  end if;
  select hits into n from public.ai_usage
    where user_id = auth.uid() and bucket = 'tutor';
  if n is distinct from 2 then
    raise exception 'expected tutor hits = 2, got %', n;
  end if;

  select public.consume_ai_quota('roleplay', 1, 3600) into first;
  select public.consume_ai_quota('roleplay', 1, 3600) into second;
  if first is not true or second is not false then
    raise exception 'expected roleplay quota to allow then deny, got % then %', first, second;
  end if;
  select hits into n from public.ai_usage
    where user_id = auth.uid() and bucket = 'roleplay';
  if n is distinct from 2 then
    raise exception 'expected roleplay hits = 2, got %', n;
  end if;

  insert into public.courses (id, owner_id, document)
  values (
    cid,
    auth.uid(),
    jsonb_build_object('id', cid::text, 'lessons', jsonb_build_array())
  )
  returning id into got;
  if got is distinct from cid then
    raise exception 'owner insert returning did not return the new id';
  end if;

  update public.courses set updated_at = now() where id = cid returning id into got;
  if got is distinct from cid then
    raise exception 'owner update returning did not return the id';
  end if;

  insert into public.course_invitations (course_id, email)
  values (cid, 'student@example.test')
  returning email into email_got;
  if email_got is distinct from 'student@example.test' then
    raise exception 'invitation returning failed';
  end if;

  update public.profiles set display_name = 'Owner' where id = auth.uid() returning id into got;
  if got is distinct from auth.uid() then
    raise exception 'profile update returning failed';
  end if;
end
\$check\$;

reset role;
select set_config('request.jwt.claims', json_build_object('sub', '${OTHER}', 'role', 'authenticated')::text, true);
set local role authenticated;
do \$check\$
declare
  n integer;
  cid uuid := '22222222-2222-2222-2222-222222222222';
begin
  select count(*) into n from public.courses where id = cid;
  if n <> 0 then
    raise exception 'non-owner read a private course (% rows)', n;
  end if;
end
\$check\$;

reset role;
select set_config('request.jwt.claims', json_build_object('sub', '${OWNER}', 'role', 'authenticated')::text, true);
set local role authenticated;
do \$check\$
declare
  n integer;
begin
  select count(*) into n from public.courses
    where id = '22222222-2222-2222-2222-222222222222';
  if n <> 1 then
    raise exception 'owner could not read the private course just inserted (% rows)', n;
  end if;
end
\$check\$;
rollback;
SQL

  psql_db "$db" <<SQL
begin;
select set_config('request.jwt.claims', json_build_object('sub', '${OTHER}', 'role', 'authenticated')::text, true);
set local role authenticated;
do \$check\$
declare
  lesson text;
  event_id bigint;
begin
  insert into public.lesson_progress (user_id, course_id, lesson_id)
  values (auth.uid(), 'legacy-demo', 'intro')
  returning course_id into lesson;
  if lesson is distinct from 'legacy-demo' then
    raise exception 'legacy progress returning failed';
  end if;
  insert into public.activity_events (user_id, course_id, event_type)
  values (auth.uid(), 'legacy-demo', 'block_completed')
  returning id into event_id;
  if event_id is null then
    raise exception 'activity event returning failed';
  end if;
end
\$check\$;

reset role;
select set_config('request.jwt.claims', json_build_object('sub', '${OWNER}', 'role', 'authenticated')::text, true);
set local role authenticated;
do \$check\$
declare
  n integer;
begin
  select count(*) into n from public.courses
    where id = '22222222-2222-2222-2222-222222222222';
  if n <> 0 then
    raise exception 'rolled-back private course is still visible';
  end if;
end
\$check\$;
rollback;
SQL

  psql_db "$db" -tA <<SQL
select case
  when (select count(*) from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'consume_ai_quota') <> 1
    then 'expected one consume_ai_quota overload'
  when (select proargnames::text from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'consume_ai_quota')
       is distinct from '{p_bucket,max_hits,window_seconds}'
    then 'unexpected consume_ai_quota argument names'
  when has_function_privilege('anon', 'public.consume_ai_quota(text,integer,integer)', 'execute')
    then 'anon can execute consume_ai_quota'
  when not has_function_privilege('authenticated', 'public.consume_ai_quota(text,integer,integer)', 'execute')
    then 'authenticated cannot execute consume_ai_quota'
  when (select count(*) from pg_policy pol
        join pg_class rel on rel.oid = pol.polrelid
        where rel.relname = 'courses' and pol.polname = 'course_read') <> 1
    then 'expected exactly one course_read policy'
  when (select pg_get_expr(pol.polqual, pol.polrelid) from pg_policy pol
        join pg_class rel on rel.oid = pol.polrelid
        where rel.relname = 'courses' and pol.polname = 'course_read')
       not like '%owner_id%'
    then 'course_read does not compare owner_id'
  else 'ok'
end;
SQL
}

echo "Creating ${EXISTING} from the three earlier migrations"
pq createdb "$EXISTING" >/dev/null
apply_base "$EXISTING"
seed_users "$EXISTING"
expect_old_failures "$EXISTING"
echo "Applying the new migration on top of the earlier three"
psql_db "$EXISTING" -f "$MIG4" >/dev/null
result="$(assert_fixed "$EXISTING" | tail -n 1)"
if [[ "$result" != "ok" ]]; then
  echo "Existing-database checks failed: $result" >&2
  exit 1
fi
echo "Re-applying the new migration"
psql_db "$EXISTING" -f "$MIG4" >/dev/null
result="$(assert_fixed "$EXISTING" | tail -n 1)"
if [[ "$result" != "ok" ]]; then
  echo "Re-run checks failed: $result" >&2
  exit 1
fi

echo "Creating ${FRESH} with all migrations in order"
pq createdb "$FRESH" >/dev/null
apply_base "$FRESH"
psql_db "$FRESH" -f "$MIG4" >/dev/null
seed_users "$FRESH"
result="$(assert_fixed "$FRESH" | tail -n 1)"
if [[ "$result" != "ok" ]]; then
  echo "Fresh-database checks failed: $result" >&2
  exit 1
fi
echo "Re-applying policies on the fresh database"
psql_db "$FRESH" -f "$MIG4" >/dev/null
result="$(assert_fixed "$FRESH" | tail -n 1)"
if [[ "$result" != "ok" ]]; then
  echo "Fresh re-run checks failed: $result" >&2
  exit 1
fi

echo "Postgres review checks passed."
