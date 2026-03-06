-- Add audit-friendly consolidation fields to process_memory.
-- Supports pruning, prioritization and deduplication without destructive deletion.

create schema if not exists writing_store;

alter table writing_store.process_memory
  add column if not exists use_count integer not null default 0,
  add column if not exists last_used_at timestamptz,
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivation_reason text not null default '',
  add column if not exists consolidated_into_memory_id bigint references writing_store.process_memory(id) on delete set null;

update writing_store.process_memory
set use_count = 0
where use_count is null;

update writing_store.process_memory
set deactivation_reason = ''
where deactivation_reason is null;

update writing_store.process_memory
set deactivated_at = coalesce(updated_at, now())
where is_active = false
  and deactivated_at is null;

alter table writing_store.process_memory
  drop constraint if exists process_memory_use_count_non_negative,
  add constraint process_memory_use_count_non_negative check (use_count >= 0),
  drop constraint if exists process_memory_consolidated_not_self,
  add constraint process_memory_consolidated_not_self check (consolidated_into_memory_id is null or consolidated_into_memory_id <> id);

create index if not exists process_memory_priority_usage_idx
  on writing_store.process_memory(project_id, is_active, priority desc, use_count desc, updated_at desc);

create index if not exists process_memory_last_used_idx
  on writing_store.process_memory(last_used_at desc);

create index if not exists process_memory_inactive_idx
  on writing_store.process_memory(project_id, is_active, deactivated_at desc)
  where is_active = false;

create index if not exists process_memory_consolidated_into_idx
  on writing_store.process_memory(consolidated_into_memory_id);

comment on column writing_store.process_memory.use_count is
  'Quantidade de vezes que o item foi utilizado no fluxo de continue writing.';

comment on column writing_store.process_memory.last_used_at is
  'Timestamp da ultima utilizacao efetiva da memoria em retrieval contextual.';

comment on column writing_store.process_memory.deactivated_at is
  'Timestamp da desativacao explicita do item de memoria.';

comment on column writing_store.process_memory.deactivation_reason is
  'Motivo auditavel da desativacao (manual, deduplicacao, TTL leve etc).';

comment on column writing_store.process_memory.consolidated_into_memory_id is
  'Ponteiro para item ativo que absorveu esta memoria em consolidacao deduplicada.';

