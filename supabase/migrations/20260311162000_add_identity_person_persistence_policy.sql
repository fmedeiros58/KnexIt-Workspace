-- Explicit lifecycle policy for canonical facial identities.

alter table knex_identity_runtime.identity_persons
  add column if not exists identity_scope text not null default 'permanent',
  add column if not exists is_archived boolean not null default false,
  add column if not exists expires_at timestamptz;

update knex_identity_runtime.identity_persons
set identity_scope = 'permanent'
where coalesce(identity_scope, '') = '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'identity_persons_identity_scope_check'
      and conrelid = 'knex_identity_runtime.identity_persons'::regclass
  ) then
    alter table knex_identity_runtime.identity_persons
      add constraint identity_persons_identity_scope_check
      check (identity_scope in ('permanent', 'temporary', 'test'));
  end if;
end
$$;

create index if not exists idx_identity_persons_scope_archived_updated
  on knex_identity_runtime.identity_persons(identity_scope, is_archived, updated_at desc);

create index if not exists idx_identity_persons_expires_at
  on knex_identity_runtime.identity_persons(expires_at)
  where expires_at is not null;
