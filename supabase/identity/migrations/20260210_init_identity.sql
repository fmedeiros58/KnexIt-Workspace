-- Identity schema for Knex ID (Supabase Identity project)

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- Base profile linked to auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table if not exists public.app_entitlements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  app_key text not null,
  plan text,
  status text not null default 'active',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((tenant_id is not null)::int + (user_id is not null)::int = 1)
);

create unique index if not exists app_entitlements_tenant_key
  on public.app_entitlements(tenant_id, app_key)
  where tenant_id is not null and user_id is null;

create unique index if not exists app_entitlements_user_key
  on public.app_entitlements(user_id, app_key)
  where user_id is not null;

-- Updated-at helper
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
for each row execute procedure public.set_updated_at();

drop trigger if exists tenants_set_updated_at on public.tenants;
create trigger tenants_set_updated_at
before update on public.tenants
for each row execute procedure public.set_updated_at();

drop trigger if exists memberships_set_updated_at on public.memberships;
create trigger memberships_set_updated_at
before update on public.memberships
for each row execute procedure public.set_updated_at();

drop trigger if exists app_entitlements_set_updated_at on public.app_entitlements;
create trigger app_entitlements_set_updated_at
before update on public.app_entitlements
for each row execute procedure public.set_updated_at();

-- Sync profile from auth.users
create or replace function public.handle_auth_user_upsert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = excluded.full_name,
      avatar_url = excluded.avatar_url,
      updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_auth_user_upsert();

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
after update on auth.users
for each row execute procedure public.handle_auth_user_upsert();

-- Helpers for RLS
create or replace function public.is_tenant_member(tid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.memberships m
    where m.tenant_id = tid
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_tenant_owner(tid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.memberships m
    where m.tenant_id = tid
      and m.user_id = auth.uid()
      and m.role = 'owner'
  );
$$;

revoke all on function public.is_tenant_member(uuid) from public;
revoke all on function public.is_tenant_owner(uuid) from public;
grant execute on function public.is_tenant_member(uuid) to authenticated;
grant execute on function public.is_tenant_owner(uuid) to authenticated;

-- RLS policies
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

alter table public.tenants enable row level security;
drop policy if exists tenants_select_member on public.tenants;
drop policy if exists tenants_insert_owner on public.tenants;
drop policy if exists tenants_update_owner on public.tenants;
drop policy if exists tenants_delete_owner on public.tenants;
create policy tenants_select_member on public.tenants
  for select using (public.is_tenant_member(id));
create policy tenants_insert_owner on public.tenants
  for insert with check (auth.uid() = created_by);
create policy tenants_update_owner on public.tenants
  for update using (auth.uid() = created_by);
create policy tenants_delete_owner on public.tenants
  for delete using (auth.uid() = created_by);

alter table public.memberships enable row level security;
drop policy if exists memberships_select on public.memberships;
drop policy if exists memberships_insert on public.memberships;
drop policy if exists memberships_update on public.memberships;
drop policy if exists memberships_delete on public.memberships;
create policy memberships_select on public.memberships
  for select using (user_id = auth.uid() or public.is_tenant_owner(tenant_id));
create policy memberships_insert on public.memberships
  for insert with check (user_id = auth.uid() or public.is_tenant_owner(tenant_id));
create policy memberships_update on public.memberships
  for update using (user_id = auth.uid() or public.is_tenant_owner(tenant_id));
create policy memberships_delete on public.memberships
  for delete using (public.is_tenant_owner(tenant_id));

alter table public.app_entitlements enable row level security;
drop policy if exists entitlements_select on public.app_entitlements;
drop policy if exists entitlements_insert on public.app_entitlements;
drop policy if exists entitlements_update on public.app_entitlements;
drop policy if exists entitlements_delete on public.app_entitlements;
create policy entitlements_select on public.app_entitlements
  for select using (
    (user_id = auth.uid()) or
    (tenant_id is not null and public.is_tenant_member(tenant_id))
  );
create policy entitlements_insert on public.app_entitlements
  for insert with check (
    (user_id = auth.uid()) or
    (tenant_id is not null and public.is_tenant_owner(tenant_id))
  );
create policy entitlements_update on public.app_entitlements
  for update using (
    (user_id = auth.uid()) or
    (tenant_id is not null and public.is_tenant_owner(tenant_id))
  );
create policy entitlements_delete on public.app_entitlements
  for delete using (
    (tenant_id is not null and public.is_tenant_owner(tenant_id))
  );
