-- KnexAI: persistencia de sessoes, threads e mensagens para evitar perda de contexto em recarregamentos.

create extension if not exists "pgcrypto";

create table if not exists public.knexai_sessions (
  id uuid primary key default gen_random_uuid(),
  client_session_id text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  client_fingerprint text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists knexai_sessions_last_seen_idx
  on public.knexai_sessions (last_seen_at desc);

create table if not exists public.knexai_threads (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.knexai_sessions(id) on delete cascade,
  title text not null default 'Novo chat',
  status text not null default 'active',
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'knexai_threads_status_check'
  ) then
    alter table public.knexai_threads
      add constraint knexai_threads_status_check
      check (status in ('active', 'archived'));
  end if;
end;
$$;

create index if not exists knexai_threads_session_idx
  on public.knexai_threads (session_id, updated_at desc);

create index if not exists knexai_threads_last_message_idx
  on public.knexai_threads (last_message_at desc);

create table if not exists public.knexai_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.knexai_threads(id) on delete cascade,
  role text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'knexai_messages_role_check'
  ) then
    alter table public.knexai_messages
      add constraint knexai_messages_role_check
      check (role in ('user', 'assistant', 'system'));
  end if;
end;
$$;

create index if not exists knexai_messages_thread_created_idx
  on public.knexai_messages (thread_id, created_at);

create index if not exists knexai_messages_role_created_idx
  on public.knexai_messages (role, created_at desc);

create index if not exists knexai_messages_metadata_gin_idx
  on public.knexai_messages using gin (metadata);

create or replace function public.knexai_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.knexai_touch_thread_and_session()
returns trigger
language plpgsql
as $$
begin
  update public.knexai_threads
     set last_message_at = new.created_at,
         updated_at = now()
   where id = new.thread_id;

  update public.knexai_sessions
     set last_seen_at = now(),
         updated_at = now()
   where id = (
     select session_id
       from public.knexai_threads
      where id = new.thread_id
   );

  return new;
end;
$$;

drop trigger if exists knexai_sessions_set_updated_at on public.knexai_sessions;
create trigger knexai_sessions_set_updated_at
before update on public.knexai_sessions
for each row execute function public.knexai_set_updated_at();

drop trigger if exists knexai_threads_set_updated_at on public.knexai_threads;
create trigger knexai_threads_set_updated_at
before update on public.knexai_threads
for each row execute function public.knexai_set_updated_at();

drop trigger if exists knexai_messages_touch_thread on public.knexai_messages;
create trigger knexai_messages_touch_thread
after insert on public.knexai_messages
for each row execute function public.knexai_touch_thread_and_session();

alter table public.knexai_sessions enable row level security;
alter table public.knexai_threads enable row level security;
alter table public.knexai_messages enable row level security;
