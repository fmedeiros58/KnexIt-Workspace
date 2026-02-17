-- KnexChat message attachments linked to media catalog.

create extension if not exists "pgcrypto";

create or replace function public.knexchat_auth_email()
returns citext
language sql
stable
security definer
set search_path = public
as $$
  select p.email
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function public.knexchat_auth_can_access_message(target_message_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor_email citext;
begin
  if auth.uid() is null or target_message_id is null then
    return false;
  end if;

  actor_email := public.knexchat_auth_email();
  if actor_email is null then
    return false;
  end if;

  return exists (
    select 1
    from public.knexchat_messages m
    join public.knexchat_thread_participants tp
      on tp.thread_id = m.thread_id
    where m.id = target_message_id
      and tp.email = actor_email
  );
end;
$$;

create or replace function public.knexchat_auth_is_message_sender(target_message_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor_email citext;
begin
  if auth.uid() is null or target_message_id is null then
    return false;
  end if;

  actor_email := public.knexchat_auth_email();
  if actor_email is null then
    return false;
  end if;

  return exists (
    select 1
    from public.knexchat_messages m
    where m.id = target_message_id
      and m.sender_email = actor_email
  );
end;
$$;

create table if not exists public.knexchat_message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.knexchat_messages(id) on delete cascade,
  media_id uuid not null references public.knexchat_media_objects(id) on delete restrict,
  kind public.knexchat_media_kind not null,
  caption text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists knexchat_message_attachments_message_sort_idx
  on public.knexchat_message_attachments (message_id, sort_order);

alter table public.knexchat_message_attachments enable row level security;

drop policy if exists "knexchat_message_attachments_select_visible" on public.knexchat_message_attachments;
create policy "knexchat_message_attachments_select_visible"
  on public.knexchat_message_attachments
  for select
  to authenticated
  using (public.knexchat_auth_can_access_message(message_id));

drop policy if exists "knexchat_message_attachments_insert_sender" on public.knexchat_message_attachments;
create policy "knexchat_message_attachments_insert_sender"
  on public.knexchat_message_attachments
  for insert
  to authenticated
  with check (
    public.knexchat_auth_is_message_sender(message_id)
    and exists (
      select 1
      from public.knexchat_media_objects mo
      where mo.id = media_id
        and mo.owner_user_id = auth.uid()
    )
  );

drop policy if exists "knexchat_message_attachments_update_sender" on public.knexchat_message_attachments;
create policy "knexchat_message_attachments_update_sender"
  on public.knexchat_message_attachments
  for update
  to authenticated
  using (public.knexchat_auth_is_message_sender(message_id))
  with check (public.knexchat_auth_is_message_sender(message_id));

drop policy if exists "knexchat_message_attachments_delete_sender" on public.knexchat_message_attachments;
create policy "knexchat_message_attachments_delete_sender"
  on public.knexchat_message_attachments
  for delete
  to authenticated
  using (public.knexchat_auth_is_message_sender(message_id));
