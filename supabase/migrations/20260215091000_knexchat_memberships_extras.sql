-- Extras for KnexChat memberships: updated_at, FK, checks, and helpful indexes.

-- Keep updated_at in sync.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_knexchat_memberships_set_updated_at'
  ) then
    create trigger trg_knexchat_memberships_set_updated_at
    before update on public.knexchat_memberships
    for each row
    execute function public.set_updated_at();
  end if;
end;
$$;

-- Ensure the membership belongs to an auth user.
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    join pg_attribute a on a.attrelid = t.oid and a.attnum = any (c.conkey)
    join pg_class rt on rt.oid = c.confrelid
    join pg_namespace rn on rn.oid = rt.relnamespace
    where c.contype = 'f'
      and n.nspname = 'public'
      and t.relname = 'knexchat_memberships'
      and a.attname = 'user_id'
      and rn.nspname = 'auth'
      and rt.relname = 'users'
  ) then
    alter table public.knexchat_memberships
      add constraint knexchat_memberships_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end;
$$;

-- Ensure normalized email matches the stored email.
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where c.contype = 'c'
      and n.nspname = 'public'
      and t.relname = 'knexchat_memberships'
      and c.conname = 'knexchat_memberships_email_normalized_check'
  ) then
    alter table public.knexchat_memberships
      add constraint knexchat_memberships_email_normalized_check
      check (
        (knexchat_email is null and email_normalized is null)
        or email_normalized = lower(trim(knexchat_email))
      );
  end if;
end;
$$;

-- Helpful indexes for token cleanup and lookups.
create index if not exists knexchat_verification_tokens_expires_at_idx
  on public.knexchat_verification_tokens (expires_at);

create index if not exists knexchat_verification_tokens_consumed_at_idx
  on public.knexchat_verification_tokens (consumed_at);
