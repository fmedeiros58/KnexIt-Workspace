-- KnexAI: memoria operacional para contexto de alta relevancia e auditoria de reforcos.

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
  if not exists (
    select 1 from pg_constraint where conname = 'knexai_memory_items_kind_check'
  ) then
    alter table public.knexai_memory_items
      add constraint knexai_memory_items_kind_check
      check (kind in ('short_term', 'long_term', 'preference', 'fact', 'task', 'safety', 'context'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'knexai_memory_items_importance_check'
  ) then
    alter table public.knexai_memory_items
      add constraint knexai_memory_items_importance_check
      check (importance >= 0 and importance <= 1);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'knexai_memory_items_confidence_check'
  ) then
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

drop trigger if exists knexai_memory_items_set_updated_at on public.knexai_memory_items;
create trigger knexai_memory_items_set_updated_at
before update on public.knexai_memory_items
for each row execute function public.knexai_set_updated_at();

alter table public.knexai_memory_items enable row level security;
alter table public.knexai_memory_events enable row level security;
