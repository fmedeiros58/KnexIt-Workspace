-- Track directory presence/activity updates for realtime online state.

alter table if exists public.knexchat_directory
  add column if not exists updated_at timestamptz;

update public.knexchat_directory
set updated_at = created_at
where updated_at is null;

alter table if exists public.knexchat_directory
  alter column updated_at set default now();

alter table if exists public.knexchat_directory
  alter column updated_at set not null;

create index if not exists knexchat_directory_updated_at_idx
  on public.knexchat_directory (updated_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_proc
    where proname = 'set_updated_at'
      and pg_function_is_visible(oid)
  ) then
    create function public.set_updated_at()
    returns trigger
    language plpgsql
    as $fn$
    begin
      new.updated_at = now();
      return new;
    end;
    $fn$;
  end if;
end;
$$;

drop trigger if exists knexchat_directory_set_updated_at on public.knexchat_directory;
create trigger knexchat_directory_set_updated_at
before update on public.knexchat_directory
for each row execute function public.set_updated_at();
