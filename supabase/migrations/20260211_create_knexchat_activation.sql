-- KnexChat activation profiles (nickname-based)

create table if not exists public.knexchat_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  nickname_normalized text not null,
  display_name text,
  terms_accepted_at timestamptz,
  activated_at timestamptz,
  nickname_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knexchat_profiles_nickname_length check (char_length(nickname_normalized) between 3 and 20),
  constraint knexchat_profiles_nickname_format check (nickname_normalized ~ '^[a-z0-9][a-z0-9._]*[a-z0-9]$'),
  constraint knexchat_profiles_nickname_separators check (nickname_normalized !~ '(\\._|_\\.|\\.\\.|__)'),
  constraint knexchat_profiles_nickname_not_numeric check (nickname_normalized !~ '^[0-9]+$')
);

create unique index if not exists knexchat_profiles_nickname_normalized_key
  on public.knexchat_profiles (nickname_normalized);

create table if not exists public.knexchat_reserved_nicknames (
  nickname_normalized text primary key
);

insert into public.knexchat_reserved_nicknames (nickname_normalized) values
  ('admin'),
  ('root'),
  ('support'),
  ('help'),
  ('api'),
  ('system'),
  ('knex'),
  ('knexchat'),
  ('knexspace'),
  ('login'),
  ('signup'),
  ('register'),
  ('activate'),
  ('settings'),
  ('terms'),
  ('privacy'),
  ('assets')
on conflict do nothing;

create or replace function public.knexchat_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists knexchat_profiles_set_updated_at on public.knexchat_profiles;
create trigger knexchat_profiles_set_updated_at
before update on public.knexchat_profiles
for each row execute function public.knexchat_set_updated_at();

alter table public.knexchat_profiles enable row level security;

drop policy if exists "knexchat_profiles_read_own" on public.knexchat_profiles;
drop policy if exists "knexchat_profiles_insert_own" on public.knexchat_profiles;
drop policy if exists "knexchat_profiles_update_own" on public.knexchat_profiles;

create policy "knexchat_profiles_read_own"
  on public.knexchat_profiles
  for select
  using (auth.uid() = user_id);

create policy "knexchat_profiles_insert_own"
  on public.knexchat_profiles
  for insert
  with check (auth.uid() = user_id);

create policy "knexchat_profiles_update_own"
  on public.knexchat_profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
