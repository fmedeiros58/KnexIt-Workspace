-- KnexChat delivery/read receipts + reactions.

create table if not exists public.knexchat_message_receipts (
  message_id uuid not null references public.knexchat_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  delivered_at timestamptz,
  read_at timestamptz,
  primary key (message_id, user_id)
);

create index if not exists knexchat_message_receipts_user_read_idx
  on public.knexchat_message_receipts (user_id, read_at desc);

create table if not exists public.knexchat_message_reactions (
  message_id uuid not null references public.knexchat_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

alter table public.knexchat_message_receipts enable row level security;
alter table public.knexchat_message_reactions enable row level security;

drop policy if exists "knexchat_message_receipts_select_visible" on public.knexchat_message_receipts;
create policy "knexchat_message_receipts_select_visible"
  on public.knexchat_message_receipts
  for select
  to authenticated
  using (public.knexchat_auth_can_access_message(message_id));

drop policy if exists "knexchat_message_receipts_insert_own" on public.knexchat_message_receipts;
create policy "knexchat_message_receipts_insert_own"
  on public.knexchat_message_receipts
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.knexchat_auth_can_access_message(message_id)
  );

drop policy if exists "knexchat_message_receipts_update_own" on public.knexchat_message_receipts;
create policy "knexchat_message_receipts_update_own"
  on public.knexchat_message_receipts
  for update
  to authenticated
  using (
    user_id = auth.uid()
    and public.knexchat_auth_can_access_message(message_id)
  )
  with check (
    user_id = auth.uid()
    and public.knexchat_auth_can_access_message(message_id)
  );

drop policy if exists "knexchat_message_reactions_select_visible" on public.knexchat_message_reactions;
create policy "knexchat_message_reactions_select_visible"
  on public.knexchat_message_reactions
  for select
  to authenticated
  using (public.knexchat_auth_can_access_message(message_id));

drop policy if exists "knexchat_message_reactions_insert_own" on public.knexchat_message_reactions;
create policy "knexchat_message_reactions_insert_own"
  on public.knexchat_message_reactions
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.knexchat_auth_can_access_message(message_id)
  );

drop policy if exists "knexchat_message_reactions_delete_own" on public.knexchat_message_reactions;
create policy "knexchat_message_reactions_delete_own"
  on public.knexchat_message_reactions
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    and public.knexchat_auth_can_access_message(message_id)
  );
