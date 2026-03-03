-- KnexAI: funcoes utilitarias para montar contexto e fazer manutencao da memoria persistida.

create or replace function public.knexai_get_recent_context(
  p_session_id uuid,
  p_thread_id uuid default null,
  p_message_limit integer default 20,
  p_memory_limit integer default 12
)
returns jsonb
language sql
stable
as $$
  with recent_messages as (
    select m.id, m.thread_id, m.role, m.content, m.created_at
      from public.knexai_messages m
      join public.knexai_threads t on t.id = m.thread_id
     where t.session_id = p_session_id
       and (p_thread_id is null or m.thread_id = p_thread_id)
     order by m.created_at desc
     limit greatest(1, least(coalesce(p_message_limit, 20), 200))
  ),
  hot_memory as (
    select mi.id, mi.kind, mi.content, mi.importance, mi.confidence, mi.tags, mi.updated_at
      from public.knexai_memory_items mi
     where mi.session_id = p_session_id
       and (mi.expires_at is null or mi.expires_at > now())
       and (p_thread_id is null or mi.thread_id is null or mi.thread_id = p_thread_id)
     order by mi.importance desc, mi.updated_at desc
     limit greatest(1, least(coalesce(p_memory_limit, 12), 200))
  )
  select jsonb_build_object(
    'messages', coalesce((select jsonb_agg(to_jsonb(recent_messages) order by recent_messages.created_at) from recent_messages), '[]'::jsonb),
    'memory', coalesce((select jsonb_agg(to_jsonb(hot_memory) order by hot_memory.importance desc, hot_memory.updated_at desc) from hot_memory), '[]'::jsonb)
  );
$$;

create or replace function public.knexai_reinforce_memory(
  p_memory_item_id uuid,
  p_delta numeric default 0.05
)
returns void
language plpgsql
as $$
begin
  update public.knexai_memory_items
     set importance = least(1.0, greatest(0.0, importance + coalesce(p_delta, 0.05))),
         reinforcement_count = reinforcement_count + 1,
         last_reinforced_at = now(),
         updated_at = now(),
         last_accessed_at = now()
   where id = p_memory_item_id;
end;
$$;

create or replace function public.knexai_prune_expired_memory(p_session_id uuid default null)
returns integer
language plpgsql
as $$
declare
  deleted_count integer := 0;
begin
  if p_session_id is null then
    delete from public.knexai_memory_items
     where expires_at is not null
       and expires_at <= now();
  else
    delete from public.knexai_memory_items
     where session_id = p_session_id
       and expires_at is not null
       and expires_at <= now();
  end if;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
