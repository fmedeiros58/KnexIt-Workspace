-- Identity schema adjustments for Knex ID (profiles + entitlements + OTP rate limits)

create extension if not exists "citext";

-- Profiles: display_name + unique email
alter table if exists public.profiles
  add column if not exists display_name text;

create unique index if not exists profiles_email_unique on public.profiles (email);

update public.profiles
set display_name = coalesce(display_name, full_name)
where display_name is null;

-- Sync profile from auth.users (include display_name)
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

-- RLS for profiles (idempotent)
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

-- Entitlements: add scope + status checks + indexes
alter table if exists public.app_entitlements
  add column if not exists scope text;

update public.app_entitlements
set scope = case when tenant_id is not null then 'tenant' else 'user' end
where scope is null;

alter table public.app_entitlements
  alter column scope set default 'user';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'app_entitlements_scope_check'
  ) then
    alter table public.app_entitlements
      add constraint app_entitlements_scope_check
      check (scope in ('tenant', 'user'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'app_entitlements_status_check'
  ) then
    alter table public.app_entitlements
      add constraint app_entitlements_status_check
      check (status in ('active', 'paused', 'canceled', 'trial'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'app_entitlements_scope_target_check'
  ) then
    alter table public.app_entitlements
      add constraint app_entitlements_scope_target_check
      check (
        (scope = 'user' and user_id is not null) or
        (scope = 'tenant' and tenant_id is not null)
      );
  end if;
end $$;

create index if not exists app_entitlements_user_status_idx
  on public.app_entitlements (app_key, user_id, status)
  where user_id is not null;

create index if not exists app_entitlements_tenant_status_idx
  on public.app_entitlements (app_key, tenant_id, status)
  where tenant_id is not null;

-- RLS policies for entitlements (idempotent)
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

-- OTP rate-limit table
create table if not exists public.auth_email_otps (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  kind text not null check (kind in ('request', 'verify')),
  token_hash text,
  request_ip text,
  created_at timestamptz not null default now()
);

create index if not exists auth_email_otps_email_created_idx
  on public.auth_email_otps (email, created_at desc);

create index if not exists auth_email_otps_ip_created_idx
  on public.auth_email_otps (request_ip, created_at desc);

create index if not exists auth_email_otps_token_idx
  on public.auth_email_otps (email, token_hash, created_at desc);

alter table public.auth_email_otps enable row level security;
