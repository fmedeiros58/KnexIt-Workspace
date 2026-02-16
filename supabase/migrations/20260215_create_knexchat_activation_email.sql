-- KnexChat activation via email (OTP)

create table if not exists public.knexchat_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'pending',
  knexchat_email text,
  email_normalized text,
  email_verified_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knexchat_memberships_status check (status in ('pending', 'active', 'locked'))
);

create index if not exists knexchat_memberships_status_idx
  on public.knexchat_memberships (status);

create index if not exists knexchat_memberships_email_normalized_idx
  on public.knexchat_memberships (email_normalized);

create table if not exists public.knexchat_verification_tokens (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null,
  destination_email text not null,
  token_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  max_attempts int not null default 5,
  sent_count int not null default 0,
  last_sent_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  ip_address text,
  user_agent text
);

create index if not exists knexchat_verification_tokens_user_purpose_created_idx
  on public.knexchat_verification_tokens (user_id, purpose, created_at desc);

create index if not exists knexchat_verification_tokens_user_purpose_consumed_idx
  on public.knexchat_verification_tokens (user_id, purpose, consumed_at);

create index if not exists knexchat_verification_tokens_destination_created_idx
  on public.knexchat_verification_tokens (destination_email, purpose, created_at desc);

drop trigger if exists knexchat_memberships_set_updated_at on public.knexchat_memberships;
create trigger knexchat_memberships_set_updated_at
before update on public.knexchat_memberships
for each row execute function public.knexchat_set_updated_at();

alter table public.knexchat_memberships enable row level security;
alter table public.knexchat_verification_tokens enable row level security;

drop policy if exists "knexchat_memberships_read_own" on public.knexchat_memberships;
drop policy if exists "knexchat_memberships_insert_own" on public.knexchat_memberships;
drop policy if exists "knexchat_memberships_update_own" on public.knexchat_memberships;

create policy "knexchat_memberships_read_own"
  on public.knexchat_memberships
  for select
  using (auth.uid() = user_id);

create policy "knexchat_memberships_insert_own"
  on public.knexchat_memberships
  for insert
  with check (auth.uid() = user_id);

create policy "knexchat_memberships_update_own"
  on public.knexchat_memberships
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "knexchat_tokens_read_own" on public.knexchat_verification_tokens;
drop policy if exists "knexchat_tokens_insert_own" on public.knexchat_verification_tokens;

create policy "knexchat_tokens_read_own"
  on public.knexchat_verification_tokens
  for select
  using (auth.uid() = user_id);

create policy "knexchat_tokens_insert_own"
  on public.knexchat_verification_tokens
  for insert
  with check (auth.uid() = user_id);
