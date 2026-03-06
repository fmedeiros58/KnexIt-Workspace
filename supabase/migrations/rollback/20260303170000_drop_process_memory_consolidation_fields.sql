-- Rollback for process_memory consolidation fields.

drop index if exists writing_store.process_memory_consolidated_into_idx;
drop index if exists writing_store.process_memory_inactive_idx;
drop index if exists writing_store.process_memory_last_used_idx;
drop index if exists writing_store.process_memory_priority_usage_idx;

alter table writing_store.process_memory
  drop constraint if exists process_memory_consolidated_not_self,
  drop constraint if exists process_memory_use_count_non_negative,
  drop column if exists consolidated_into_memory_id,
  drop column if exists deactivation_reason,
  drop column if exists deactivated_at,
  drop column if exists last_used_at,
  drop column if exists use_count;

