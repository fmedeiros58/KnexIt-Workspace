-- Core identity data for KnexChat (profiles + email OTP rate limits).

create extension if not exists "pgcrypto";
create extension if not exists "citext";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext,
  full_name text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

-- Ensure columns exist if profiles table was created earlier without display_name.
alter table if exists public.profiles
  add column if not exists display_name text;

create unique index if not exists profiles_email_unique on public.profiles (email);

update public.profiles
set display_name = coalesce(display_name, full_name)
where display_name is null;

-- Ensure updated_at helper exists.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Sync profile from auth.users (idempotent).
create or replace function public.handle_auth_user_upsert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = excluded.full_name,
      display_name = excluded.display_name,
      avatar_url = excluded.avatar_url,
      updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_auth_user_upsert();

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
after update on auth.users
for each row execute function public.handle_auth_user_upsert();

-- RLS for profiles.
alter table public.profiles enable row level security;
drop policy if exists profiles_select_self on public.profiles;
drop policy if exists profiles_insert_self on public.profiles;
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select using (auth.uid() = id);
create policy profiles_insert_self on public.profiles
  for insert with check (auth.uid() = id);
create policy profiles_update_self on public.profiles
  for update using (auth.uid() = id);

-- Email OTP rate-limit tracking table.
create table if not exists public.auth_email_otps (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  kind text not null,
  token_hash text,
  request_ip text,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'auth_email_otps_kind_check'
  ) then
    alter table public.auth_email_otps
      add constraint auth_email_otps_kind_check
      check (kind in ('request', 'verify'));
  end if;
end;
$$;

create index if not exists auth_email_otps_email_created_idx
  on public.auth_email_otps (email, created_at desc);

create index if not exists auth_email_otps_ip_created_idx
  on public.auth_email_otps (request_ip, created_at desc);

create index if not exists auth_email_otps_token_idx
  on public.auth_email_otps (email, token_hash, created_at desc);

alter table public.auth_email_otps enable row level security;
