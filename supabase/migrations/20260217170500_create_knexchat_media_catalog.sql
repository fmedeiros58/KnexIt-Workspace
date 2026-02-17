-- KnexChat media catalog + profile photo pointers.

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'knexchat_media_kind'
  ) then
    create type public.knexchat_media_kind as enum ('image', 'video', 'audio', 'file');
  end if;
end;
$$;

create table if not exists public.knexchat_media_objects (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null,
  object_path text not null,
  kind public.knexchat_media_kind not null,
  mime_type text,
  size_bytes bigint,
  width integer,
  height integer,
  duration_ms integer,
  checksum text,
  created_at timestamptz not null default now(),
  constraint knexchat_media_objects_bucket_object_key unique (bucket, object_path)
);

create index if not exists knexchat_media_objects_owner_created_idx
  on public.knexchat_media_objects (owner_user_id, created_at desc);

create table if not exists public.knexchat_profile_photos (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_id uuid not null references public.knexchat_media_objects(id) on delete restrict,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, media_id)
);

create unique index if not exists knexchat_profile_photos_one_current_idx
  on public.knexchat_profile_photos (user_id)
  where is_current = true;

alter table if exists public.knexchat_profiles
  add column if not exists avatar_updated_at timestamptz not null default now(),
  add column if not exists current_avatar_media_id uuid;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'knexchat_profiles'
      and column_name = 'current_avatar_media_id'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'knexchat_profiles_current_avatar_media_id_fkey'
  ) then
    alter table public.knexchat_profiles
      add constraint knexchat_profiles_current_avatar_media_id_fkey
      foreign key (current_avatar_media_id)
      references public.knexchat_media_objects(id)
      on delete set null;
  end if;
end;
$$;

alter table public.knexchat_media_objects enable row level security;
alter table public.knexchat_profile_photos enable row level security;

drop policy if exists "knexchat_media_objects_select_own" on public.knexchat_media_objects;
create policy "knexchat_media_objects_select_own"
  on public.knexchat_media_objects
  for select
  to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists "knexchat_media_objects_insert_own" on public.knexchat_media_objects;
create policy "knexchat_media_objects_insert_own"
  on public.knexchat_media_objects
  for insert
  to authenticated
  with check (owner_user_id = auth.uid());

drop policy if exists "knexchat_media_objects_update_own" on public.knexchat_media_objects;
create policy "knexchat_media_objects_update_own"
  on public.knexchat_media_objects
  for update
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "knexchat_media_objects_delete_own" on public.knexchat_media_objects;
create policy "knexchat_media_objects_delete_own"
  on public.knexchat_media_objects
  for delete
  to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists "knexchat_profile_photos_select_own" on public.knexchat_profile_photos;
create policy "knexchat_profile_photos_select_own"
  on public.knexchat_profile_photos
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "knexchat_profile_photos_insert_own" on public.knexchat_profile_photos;
create policy "knexchat_profile_photos_insert_own"
  on public.knexchat_profile_photos
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "knexchat_profile_photos_update_own" on public.knexchat_profile_photos;
create policy "knexchat_profile_photos_update_own"
  on public.knexchat_profile_photos
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "knexchat_profile_photos_delete_own" on public.knexchat_profile_photos;
create policy "knexchat_profile_photos_delete_own"
  on public.knexchat_profile_photos
  for delete
  to authenticated
  using (user_id = auth.uid());
