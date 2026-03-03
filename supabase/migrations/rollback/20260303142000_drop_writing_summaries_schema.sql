-- Manual rollback for writing summaries schema.
-- Execute only when explicitly reverting summary layer migrations.

drop trigger if exists project_global_summaries_set_updated_at on writing_store.project_global_summaries;
drop trigger if exists section_summaries_set_updated_at on writing_store.section_summaries;

drop table if exists writing_store.project_global_summaries;
drop table if exists writing_store.section_summaries;

drop index if exists writing_store.writing_sections_id_project_unique_idx;

