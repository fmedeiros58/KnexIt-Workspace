-- KnexChat storage buckets + path-aware storage policies (idempotent).

insert into storage.buckets (id, name, public)
values
  ('knexchat-public', 'knexchat-public', true),
  ('knexchat-private', 'knexchat-private', false)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public;

create or replace function public.knexchat_storage_thread_id(object_name text)
returns uuid
language sql
stable
as $$
  select nullif(
    (regexp_match(
      object_name,
      '^t/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})/m/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/[^/]+$'
    ))[1],
    ''
  )::uuid;
$$;

create or replace function public.knexchat_storage_message_id(object_name text)
returns uuid
language sql
stable
as $$
  select nullif(
    (regexp_match(
      object_name,
      '^t/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/m/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})/[^/]+$'
    ))[1],
    ''
  )::uuid;
$$;

create or replace function public.knexchat_profile_email(actor_id uuid)
returns citext
language sql
stable
security definer
set search_path = public
as $$
  select p.email
  from public.profiles p
  where p.id = actor_id
  limit 1;
$$;

create or replace function public.knexchat_auth_participates_thread(target_thread_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor_email citext;
begin
  if auth.uid() is null or target_thread_id is null then
    return false;
  end if;

  actor_email := public.knexchat_profile_email(auth.uid());
  if actor_email is null then
    return false;
  end if;

  return exists (
    select 1
    from public.knexchat_thread_participants tp
    where tp.thread_id = target_thread_id
      and tp.email = actor_email
  );
end;
$$;

create or replace function public.knexchat_is_private_attachment_path(object_name text)
returns boolean
language sql
stable
as $$
  select object_name ~ '^t/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/m/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/[^/]+\.[^/]+$';
$$;

create or replace function public.knexchat_can_access_private_object(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parsed_thread_id uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  parsed_thread_id := public.knexchat_storage_thread_id(object_name);
  if parsed_thread_id is null then
    return false;
  end if;

  return public.knexchat_auth_participates_thread(parsed_thread_id);
end;
$$;

create or replace function public.knexchat_is_own_public_object_path(object_name text)
returns boolean
language plpgsql
stable
as $$
begin
  if auth.uid() is null then
    return false;
  end if;

  return object_name like ('u/' || auth.uid()::text || '/avatar/%')
      or object_name like ('u/' || auth.uid()::text || '/posts/%')
      or object_name like ('u/' || auth.uid()::text || '/reels/%');
end;
$$;

drop policy if exists "knexchat_public_read" on storage.objects;
create policy "knexchat_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'knexchat-public');

drop policy if exists "knexchat_public_insert_own_paths" on storage.objects;
create policy "knexchat_public_insert_own_paths"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'knexchat-public'
    and auth.uid() is not null
    and public.knexchat_is_own_public_object_path(name)
  );

drop policy if exists "knexchat_public_update_own_paths" on storage.objects;
create policy "knexchat_public_update_own_paths"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'knexchat-public'
    and auth.uid() is not null
    and public.knexchat_is_own_public_object_path(name)
  )
  with check (
    bucket_id = 'knexchat-public'
    and auth.uid() is not null
    and public.knexchat_is_own_public_object_path(name)
  );

drop policy if exists "knexchat_public_delete_own_paths" on storage.objects;
create policy "knexchat_public_delete_own_paths"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'knexchat-public'
    and auth.uid() is not null
    and public.knexchat_is_own_public_object_path(name)
    and owner::text = auth.uid()::text
  );

drop policy if exists "knexchat_private_select_participant" on storage.objects;
create policy "knexchat_private_select_participant"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'knexchat-private'
    and auth.uid() is not null
    and public.knexchat_can_access_private_object(name)
  );

drop policy if exists "knexchat_private_insert_participant" on storage.objects;
create policy "knexchat_private_insert_participant"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'knexchat-private'
    and auth.uid() is not null
    and public.knexchat_is_private_attachment_path(name)
    and public.knexchat_can_access_private_object(name)
  );

drop policy if exists "knexchat_private_update_owner" on storage.objects;
create policy "knexchat_private_update_owner"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'knexchat-private'
    and auth.uid() is not null
    and owner::text = auth.uid()::text
  )
  with check (
    bucket_id = 'knexchat-private'
    and auth.uid() is not null
    and owner::text = auth.uid()::text
  );

drop policy if exists "knexchat_private_delete_owner" on storage.objects;
create policy "knexchat_private_delete_owner"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'knexchat-private'
    and auth.uid() is not null
    and owner::text = auth.uid()::text
  );
