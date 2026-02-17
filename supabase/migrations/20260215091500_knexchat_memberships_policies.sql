-- Enable RLS and restrict KnexChat memberships to the owning user only.
alter table public.knexchat_memberships enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'knexchat_memberships'
      and policyname = 'knexchat_memberships_select_own'
  ) then
    -- Allow users to read their own membership only.
    create policy "knexchat_memberships_select_own"
      on public.knexchat_memberships
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'knexchat_memberships'
      and policyname = 'knexchat_memberships_upsert_own'
  ) then
    -- Allow users to insert their own membership only.
    create policy "knexchat_memberships_upsert_own"
      on public.knexchat_memberships
      for insert
      to authenticated
      with check (user_id = auth.uid());
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'knexchat_memberships'
      and policyname = 'knexchat_memberships_update_own'
  ) then
    -- Allow users to update their own membership only.
    create policy "knexchat_memberships_update_own"
      on public.knexchat_memberships
      for update
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end;
$$;
