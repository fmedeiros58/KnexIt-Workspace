-- KnexAI unified local migration (single file)
-- Goal:
-- 1) Durable data on local SQL storage (NVMe-backed Postgres data directory).
-- 2) Keep hot memory in server RAM (ANM runtime), with SQL used as durable/audit layer.

create extension if not exists "pgcrypto";

-- Sessions
create table if not exists public.knexai_sessions (
  id uuid primary key default gen_random_uuid(),
  client_session_id text not null unique,
  user_id uuid,
  client_fingerprint text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- Optional FK for Supabase-auth environments only.
do $$
begin
  if to_regclass('auth.users') is not null
     and not exists (select 1 from pg_constraint where conname = 'knexai_sessions_user_id_fkey')
  then
    alter table public.knexai_sessions
      add constraint knexai_sessions_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete set null;
  end if;
end;
$$;

create index if not exists knexai_sessions_last_seen_idx
  on public.knexai_sessions (last_seen_at desc);

-- Threads
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
  if not exists (select 1 from pg_constraint where conname = 'knexai_threads_status_check') then
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

-- Messages
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
  if not exists (select 1 from pg_constraint where conname = 'knexai_messages_role_check') then
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

-- Memory tables (durable layer, not hot path)
create table if not exists public.knexai_memory_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.knexai_sessions(id) on delete cascade,
  thread_id uuid references public.knexai_threads(id) on delete cascade,
  source_message_id uuid references public.knexai_messages(id) on delete set null,
  kind text not null,
  content text not null,
  tags text[] not null default '{}',
  importance numeric(5,4) not null default 0.5,
  confidence numeric(5,4) not null default 0.5,
  decay_rate numeric(5,4) not null default 0.01,
  reinforcement_count integer not null default 0,
  last_reinforced_at timestamptz,
  last_accessed_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'knexai_memory_items_kind_check') then
    alter table public.knexai_memory_items
      add constraint knexai_memory_items_kind_check
      check (kind in ('short_term', 'long_term', 'preference', 'fact', 'task', 'safety', 'context'));
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'knexai_memory_items_importance_check') then
    alter table public.knexai_memory_items
      add constraint knexai_memory_items_importance_check
      check (importance >= 0 and importance <= 1);
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'knexai_memory_items_confidence_check') then
    alter table public.knexai_memory_items
      add constraint knexai_memory_items_confidence_check
      check (confidence >= 0 and confidence <= 1);
  end if;
end;
$$;

create index if not exists knexai_memory_items_session_kind_idx
  on public.knexai_memory_items (session_id, kind, importance desc);

create index if not exists knexai_memory_items_thread_idx
  on public.knexai_memory_items (thread_id, created_at desc);

create index if not exists knexai_memory_items_expires_idx
  on public.knexai_memory_items (expires_at);

create index if not exists knexai_memory_items_metadata_gin_idx
  on public.knexai_memory_items using gin (metadata);

create table if not exists public.knexai_memory_events (
  id bigserial primary key,
  session_id uuid not null references public.knexai_sessions(id) on delete cascade,
  thread_id uuid references public.knexai_threads(id) on delete cascade,
  memory_item_id uuid references public.knexai_memory_items(id) on delete set null,
  event text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists knexai_memory_events_session_created_idx
  on public.knexai_memory_events (session_id, created_at desc);

create index if not exists knexai_memory_events_event_created_idx
  on public.knexai_memory_events (event, created_at desc);

-- Utility functions
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

create or replace function public.knexai_get_recent_context(
  p_session_id uuid,
  p_thread_id uuid default null,
  p_message_limit integer default 20,
  p_memory_limit integer default 12
)
returns jsonb
language sql
stable
as $$
  with recent_messages as (
    select m.id, m.thread_id, m.role, m.content, m.created_at
      from public.knexai_messages m
      join public.knexai_threads t on t.id = m.thread_id
     where t.session_id = p_session_id
       and (p_thread_id is null or m.thread_id = p_thread_id)
     order by m.created_at desc
     limit greatest(1, least(coalesce(p_message_limit, 20), 200))
  ),
  hot_memory as (
    select mi.id, mi.kind, mi.content, mi.importance, mi.confidence, mi.tags, mi.updated_at
      from public.knexai_memory_items mi
     where mi.session_id = p_session_id
       and (mi.expires_at is null or mi.expires_at > now())
       and (p_thread_id is null or mi.thread_id is null or mi.thread_id = p_thread_id)
     order by mi.importance desc, mi.updated_at desc
     limit greatest(1, least(coalesce(p_memory_limit, 12), 200))
  )
  select jsonb_build_object(
    'messages', coalesce((select jsonb_agg(to_jsonb(recent_messages) order by recent_messages.created_at) from recent_messages), '[]'::jsonb),
    'memory', coalesce((select jsonb_agg(to_jsonb(hot_memory) order by hot_memory.importance desc, hot_memory.updated_at desc) from hot_memory), '[]'::jsonb)
  );
$$;

create or replace function public.knexai_reinforce_memory(
  p_memory_item_id uuid,
  p_delta numeric default 0.05
)
returns void
language plpgsql
as $$
begin
  update public.knexai_memory_items
     set importance = least(1.0, greatest(0.0, importance + coalesce(p_delta, 0.05))),
         reinforcement_count = reinforcement_count + 1,
         last_reinforced_at = now(),
         updated_at = now(),
         last_accessed_at = now()
   where id = p_memory_item_id;
end;
$$;

create or replace function public.knexai_prune_expired_memory(p_session_id uuid default null)
returns integer
language plpgsql
as $$
declare
  deleted_count integer := 0;
begin
  if p_session_id is null then
    delete from public.knexai_memory_items
     where expires_at is not null
       and expires_at <= now();
  else
    delete from public.knexai_memory_items
     where session_id = p_session_id
       and expires_at is not null
       and expires_at <= now();
  end if;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- Triggers
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

drop trigger if exists knexai_memory_items_set_updated_at on public.knexai_memory_items;
create trigger knexai_memory_items_set_updated_at
before update on public.knexai_memory_items
for each row execute function public.knexai_set_updated_at();

-- RLS enabled (policies can be added per deployment profile)
alter table public.knexai_sessions enable row level security;
alter table public.knexai_threads enable row level security;
alter table public.knexai_messages enable row level security;
alter table public.knexai_memory_items enable row level security;
alter table public.knexai_memory_events enable row level security;
