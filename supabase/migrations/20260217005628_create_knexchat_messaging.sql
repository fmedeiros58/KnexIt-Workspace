-- KnexChat messaging: threads, participants, and messages.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

create table if not exists public.knexchat_threads (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  title text,
  created_by citext not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'knexchat_threads_kind_check'
  ) then
    alter table public.knexchat_threads
      add constraint knexchat_threads_kind_check
      check (kind in ('direct', 'group', 'forum'));
  end if;
end;
$$;

create index if not exists knexchat_threads_created_by_idx
  on public.knexchat_threads (created_by);

create index if not exists knexchat_threads_last_message_at_idx
  on public.knexchat_threads (last_message_at desc);

create table if not exists public.knexchat_thread_participants (
  thread_id uuid not null references public.knexchat_threads(id) on delete cascade,
  email citext not null,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (thread_id, email)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'knexchat_thread_participants_role_check'
  ) then
    alter table public.knexchat_thread_participants
      add constraint knexchat_thread_participants_role_check
      check (role in ('admin', 'member'));
  end if;
end;
$$;

create index if not exists knexchat_thread_participants_email_idx
  on public.knexchat_thread_participants (email);

create table if not exists public.knexchat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.knexchat_threads(id) on delete cascade,
  sender_email citext not null,
  body text,
  kind text not null default 'text',
  media_url text,
  media_name text,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'knexchat_messages_kind_check'
  ) then
    alter table public.knexchat_messages
      add constraint knexchat_messages_kind_check
      check (kind in ('text', 'image', 'audio', 'file'));
  end if;
end;
$$;

create index if not exists knexchat_messages_thread_created_idx
  on public.knexchat_messages (thread_id, created_at);

-- Touch thread timestamps on new messages.
create or replace function public.knexchat_touch_thread()
returns trigger
language plpgsql
as $$
begin
  update public.knexchat_threads
    set last_message_at = new.created_at,
        updated_at = now()
  where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists knexchat_messages_touch_thread on public.knexchat_messages;
create trigger knexchat_messages_touch_thread
after insert on public.knexchat_messages
for each row execute function public.knexchat_touch_thread();

-- Keep updated_at synced on manual thread updates.
drop trigger if exists knexchat_threads_set_updated_at on public.knexchat_threads;
create trigger knexchat_threads_set_updated_at
before update on public.knexchat_threads
for each row execute function public.set_updated_at();

-- Enable RLS (service role uses server-side access).
alter table public.knexchat_threads enable row level security;
alter table public.knexchat_thread_participants enable row level security;
alter table public.knexchat_messages enable row level security;

drop policy if exists "knexchat_threads_read" on public.knexchat_threads;
drop policy if exists "knexchat_threads_write" on public.knexchat_threads;
drop policy if exists "knexchat_thread_participants_read" on public.knexchat_thread_participants;
drop policy if exists "knexchat_thread_participants_write" on public.knexchat_thread_participants;
drop policy if exists "knexchat_messages_read" on public.knexchat_messages;
drop policy if exists "knexchat_messages_write" on public.knexchat_messages;
