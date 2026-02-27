-- Ensure KnexChat realtime tables are published to Supabase Realtime.

do $$
declare
  target_table text;
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    foreach target_table in array array[
      'knexchat_messages',
      'knexchat_thread_participants',
      'knexchat_threads',
      'knexchat_directory',
      'knexchat_contact_requests'
    ]
    loop
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = target_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', target_table);
      end if;
    end loop;
  end if;
exception
  when insufficient_privilege then
    null;
end;
$$;
