-- KnexChat messaging core tables
create extension if not exists "pgcrypto";

create table if not exists public.knexchat_threads (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'direct' check (kind in ('direct', 'group', 'forum')),
  title text,
  created_by text not null references public.knexchat_directory(email) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz
);

create table if not exists public.knexchat_thread_participants (
  thread_id uuid not null references public.knexchat_threads(id) on delete cascade,
  email text not null references public.knexchat_directory(email) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (thread_id, email)
);

create table if not exists public.knexchat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.knexchat_threads(id) on delete cascade,
  sender_email text not null references public.knexchat_directory(email) on delete restrict,
  body text,
  kind text not null default 'text' check (kind in ('text', 'image', 'audio', 'file')),
  media_url text,
  media_name text,
  created_at timestamptz not null default now()
);

create index if not exists knexchat_thread_participants_email_idx
  on public.knexchat_thread_participants (email);

create index if not exists knexchat_messages_thread_id_created_at_idx
  on public.knexchat_messages (thread_id, created_at desc);

create or replace function public.knexchat_update_thread_last_message()
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

drop trigger if exists knexchat_messages_after_insert on public.knexchat_messages;
create trigger knexchat_messages_after_insert
after insert on public.knexchat_messages
for each row execute function public.knexchat_update_thread_last_message();

-- RLS enabled; access via service role (server)
alter table public.knexchat_threads enable row level security;
alter table public.knexchat_thread_participants enable row level security;
alter table public.knexchat_messages enable row level security;

drop policy if exists "knexchat_threads_read" on public.knexchat_threads;
drop policy if exists "knexchat_threads_insert" on public.knexchat_threads;
drop policy if exists "knexchat_participants_read" on public.knexchat_thread_participants;
drop policy if exists "knexchat_participants_insert" on public.knexchat_thread_participants;
drop policy if exists "knexchat_messages_read" on public.knexchat_messages;
drop policy if exists "knexchat_messages_insert" on public.knexchat_messages;
