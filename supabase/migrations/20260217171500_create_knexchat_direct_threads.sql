-- KnexChat canonical mapping for 1:1 direct thread pairs.

create table if not exists public.knexchat_direct_threads (
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null unique references public.knexchat_threads(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  constraint knexchat_direct_threads_order_check check (user_a < user_b)
);

alter table public.knexchat_direct_threads enable row level security;

drop policy if exists "knexchat_direct_threads_select_participants" on public.knexchat_direct_threads;
create policy "knexchat_direct_threads_select_participants"
  on public.knexchat_direct_threads
  for select
  to authenticated
  using (auth.uid() = user_a or auth.uid() = user_b);

drop policy if exists "knexchat_direct_threads_insert_participants" on public.knexchat_direct_threads;
create policy "knexchat_direct_threads_insert_participants"
  on public.knexchat_direct_threads
  for insert
  to authenticated
  with check (auth.uid() = user_a or auth.uid() = user_b);

drop policy if exists "knexchat_direct_threads_update_participants" on public.knexchat_direct_threads;
create policy "knexchat_direct_threads_update_participants"
  on public.knexchat_direct_threads
  for update
  to authenticated
  using (auth.uid() = user_a or auth.uid() = user_b)
  with check (auth.uid() = user_a or auth.uid() = user_b);
