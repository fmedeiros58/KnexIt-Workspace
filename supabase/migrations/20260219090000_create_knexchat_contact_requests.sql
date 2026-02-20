-- KnexChat contact requests persistence.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

create table if not exists public.knexchat_contact_requests (
  id uuid primary key default gen_random_uuid(),
  requester_email citext not null,
  target_email citext not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint knexchat_contact_requests_not_self_check check (requester_email <> target_email)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'knexchat_contact_requests_status_check'
  ) then
    alter table public.knexchat_contact_requests
      add constraint knexchat_contact_requests_status_check
      check (status in ('pending', 'accepted', 'rejected', 'blocked', 'canceled'));
  end if;
end;
$$;

create unique index if not exists knexchat_contact_requests_pair_unique_idx
  on public.knexchat_contact_requests (requester_email, target_email);

create index if not exists knexchat_contact_requests_target_status_idx
  on public.knexchat_contact_requests (target_email, status, updated_at desc);

create index if not exists knexchat_contact_requests_requester_status_idx
  on public.knexchat_contact_requests (requester_email, status, updated_at desc);

drop trigger if exists knexchat_contact_requests_set_updated_at on public.knexchat_contact_requests;
create trigger knexchat_contact_requests_set_updated_at
before update on public.knexchat_contact_requests
for each row execute function public.set_updated_at();

alter table public.knexchat_contact_requests enable row level security;

drop policy if exists "knexchat_contact_requests_select_own" on public.knexchat_contact_requests;
create policy "knexchat_contact_requests_select_own"
  on public.knexchat_contact_requests
  for select
  to authenticated
  using (
    public.knexchat_auth_email() = requester_email
    or public.knexchat_auth_email() = target_email
  );

drop policy if exists "knexchat_contact_requests_insert_requester" on public.knexchat_contact_requests;
create policy "knexchat_contact_requests_insert_requester"
  on public.knexchat_contact_requests
  for insert
  to authenticated
  with check (public.knexchat_auth_email() = requester_email);

drop policy if exists "knexchat_contact_requests_update_participants" on public.knexchat_contact_requests;
create policy "knexchat_contact_requests_update_participants"
  on public.knexchat_contact_requests
  for update
  to authenticated
  using (
    public.knexchat_auth_email() = requester_email
    or public.knexchat_auth_email() = target_email
  )
  with check (
    public.knexchat_auth_email() = requester_email
    or public.knexchat_auth_email() = target_email
  );

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'knexchat_contact_requests'
  ) then
    alter publication supabase_realtime add table public.knexchat_contact_requests;
  end if;
exception
  when insufficient_privilege then
    null;
end;
$$;
