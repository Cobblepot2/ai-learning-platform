begin;

alter table public.classes add column projects_version integer not null default 0 check (projects_version >= 0);

-- All application writes use the versioned transaction below. Keeping direct
-- insert/delete grants would let clients bypass the concurrency check.
revoke insert, delete on public.class_projects from authenticated;

create function public.replace_class_projects(p_class_id uuid, p_expected_version integer, p_projects text[])
returns integer language plpgsql security definer set search_path = '' as $$
declare current_version integer;
begin
  if auth.uid() is null or not private.is_teacher() or not private.owns_class(p_class_id) then
    raise exception 'Instructor class ownership required' using errcode = '42501';
  end if;
  if p_expected_version is null or p_expected_version < 0 or p_projects is null
    or cardinality(p_projects) > 20 or exists (
      select 1 from unnest(p_projects) p(id) where id is null or id !~ '^[a-z0-9-]{1,64}$'
    ) then
    raise exception 'Invalid project selection' using errcode = '22023';
  end if;
  -- Generated projects may only be assigned by their owner. Built-ins are
  -- validated against the deployed catalogue by the API (they live in code).
  if exists (
    select 1 from unnest(p_projects) p(id) where id like 'gen-%' and not exists (
      select 1 from public.generated_projects g where g.id = p.id and g.owner_id = auth.uid()
    )
  ) then
    raise exception 'Project ownership required' using errcode = '42501';
  end if;

  select c.projects_version into current_version from public.classes c
    where c.id = p_class_id and c.owner_id = auth.uid() for update;
  if not found then raise exception 'Class not found' using errcode = '42501'; end if;
  if current_version <> p_expected_version then
    -- Deliberate conflict, not a retryable PostgreSQL serialization failure.
    raise exception 'Class assignments changed; reload before saving' using errcode = 'PT409';
  end if;

  delete from public.class_projects where class_id = p_class_id and not (project_id = any(p_projects));
  insert into public.class_projects(class_id, project_id)
    select p_class_id, id from unnest(p_projects) p(id) on conflict do nothing;
  update public.classes set projects_version = projects_version + 1 where id = p_class_id;
  return current_version + 1;
end; $$;
revoke all on function public.replace_class_projects(uuid, integer, text[]) from public, anon;
grant execute on function public.replace_class_projects(uuid, integer, text[]) to authenticated;

commit;
