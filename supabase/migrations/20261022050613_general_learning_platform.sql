-- Domain-neutral courses. All browser access is RLS scoped; privileged writes are
-- limited to server-generated learning evidence after a user-scoped access check.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, anon;

-- Prevent role escalation through UPDATE, INSERT, upsert or delete/recreate.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, background, experience, goal, language, updated_at) on public.profiles to authenticated;
grant insert (id, display_name, background, experience, goal, language, updated_at) on public.profiles to authenticated;
create function private.guard_profile_role() returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') and
     ((TG_OP = 'INSERT' and new.role <> 'student') or (TG_OP = 'UPDATE' and new.role is distinct from old.role)) then
    raise exception 'Only an administrator may assign roles';
  end if;
  return new;
end; $$;
create trigger protect_profile_role before insert or update on public.profiles for each row execute function private.guard_profile_role();
revoke all on function public.handle_new_user() from public, anon, authenticated;

create function private.is_teacher() returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from public.profiles where id = auth.uid() and role in ('instructor','admin'));
$$;
revoke all on function private.is_teacher() from public;
grant execute on function private.is_teacher() to authenticated;

create table public.courses (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','published')),
  visibility text not null default 'private' check (visibility in ('private','enrolled','public')),
  document jsonb not null check (jsonb_typeof(document) = 'object' and document ? 'id' and document ? 'lessons' and document->>'id' = id::text and jsonb_typeof(document->'lessons') = 'array'),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index courses_owner_idx on public.courses(owner_id);
create table public.course_enrolments (
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(course_id,student_id)
);
create index enrolments_student_idx on public.course_enrolments(student_id);
create table public.course_invitations (
  course_id uuid not null references public.courses(id) on delete cascade,
  email text not null check (email = lower(trim(email))),
  created_at timestamptz not null default now(), primary key(course_id,email)
);
create table public.learning_attempts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  lesson_id text not null, activity_id text not null,
  course_revision integer not null,
  activity_snapshot jsonb not null,
  response text not null,
  feedback jsonb,
  score numeric check (score >= 0 and score <= 1),
  created_at timestamptz not null default now()
);
create index learning_attempts_course_user_idx on public.learning_attempts(course_id,user_id);

-- Internal lookups avoid recursive course/enrolment RLS. Every helper scopes
-- to auth.uid(); no caller-supplied user or role can broaden access.
create function private.owns_course(cid uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from public.courses where id = cid and owner_id = auth.uid());
$$;
create function private.teaches_course(cid uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_teacher() and private.owns_course(cid);
$$;
create function private.can_learn(cid uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.courses c where c.id = cid and (
    c.owner_id = auth.uid() or (c.status = 'published' and (
      c.visibility = 'public' or (c.visibility = 'enrolled' and exists(select 1 from public.course_enrolments e where e.course_id = c.id and e.student_id = auth.uid()))
    ))));
$$;
revoke all on function private.owns_course(uuid), private.teaches_course(uuid), private.can_learn(uuid) from public;
grant execute on function private.owns_course(uuid), private.teaches_course(uuid) to authenticated;
grant execute on function private.can_learn(uuid) to authenticated, anon;

alter table public.courses enable row level security;
alter table public.course_enrolments enable row level security;
alter table public.course_invitations enable row level security;
alter table public.learning_attempts enable row level security;
grant select on public.courses to anon, authenticated;
grant insert, update, delete on public.courses to authenticated;
grant select, insert, delete on public.course_enrolments to authenticated;
grant select, insert, delete on public.course_invitations to authenticated;
grant select on public.learning_attempts to authenticated;
revoke insert, update, delete on public.learning_attempts from anon, authenticated;
grant select, insert, update on public.lesson_progress to service_role;
grant all on public.courses, public.course_enrolments, public.course_invitations, public.learning_attempts to service_role;
create policy course_read on public.courses for select using (private.can_learn(id));
create policy course_create on public.courses for insert to authenticated with check (owner_id = auth.uid() and status = 'draft' and visibility = 'private');
create policy course_edit on public.courses for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid() and (private.is_teacher() or (status = 'draft' and visibility = 'private')));
create policy course_delete on public.courses for delete to authenticated using (owner_id = auth.uid() and status = 'draft');
create policy enrolment_read on public.course_enrolments for select to authenticated using (student_id = auth.uid() or private.teaches_course(course_id));
create policy enrolment_add on public.course_enrolments for insert to authenticated with check (private.teaches_course(course_id));
create policy enrolment_remove on public.course_enrolments for delete to authenticated using (private.teaches_course(course_id));
create policy invitation_read on public.course_invitations for select to authenticated using (private.teaches_course(course_id));
create policy invitation_add on public.course_invitations for insert to authenticated with check (private.teaches_course(course_id));
create policy invitation_remove on public.course_invitations for delete to authenticated using (private.teaches_course(course_id));
create policy attempts_read on public.learning_attempts for select to authenticated using (user_id = auth.uid() or private.teaches_course(course_id));

-- Claim only invitations to the signed-in user's confirmed email. This is the
-- one intentional public definer RPC: no user-id/email arguments are accepted.
create function public.claim_course_invitations() returns integer language plpgsql security definer set search_path = '' as $$
declare n integer; verified_email text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select lower(email) into verified_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if verified_email is null then raise exception 'Confirm your email first'; end if;
  insert into public.course_enrolments(course_id,student_id)
    select course_id, auth.uid() from public.course_invitations where email = verified_email on conflict do nothing;
  get diagnostics n = row_count;
  delete from public.course_invitations where email = verified_email;
  return n;
end; $$;
revoke all on function public.claim_course_invitations() from public, anon;
grant execute on function public.claim_course_invitations() to authenticated;

create policy roster_profile_read on public.profiles for select to authenticated using (
  exists(select 1 from public.course_enrolments e where e.student_id = profiles.id and private.teaches_course(e.course_id))
);
create policy teacher_progress_read on public.lesson_progress for select to authenticated using (
  exists(select 1 from public.courses c where c.id::text = lesson_progress.course_id and private.teaches_course(c.id))
);
-- Legacy local demos keep their existing progress interface. Dynamic progress
-- is written only by the server after checking actual recorded attempts.
create policy dynamic_progress_write_guard on public.lesson_progress as restrictive for all to authenticated
  using (true) with check (lesson_progress.course_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
commit;
