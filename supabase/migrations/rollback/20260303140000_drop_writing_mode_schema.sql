-- Manual rollback for writing mode schema.
-- Execute only when explicitly reverting Etapa 3 writing schema.

drop index if exists writing_store.process_memory_embeddings_embedding_hnsw_cosine_idx;
drop index if exists writing_store.draft_chunk_embeddings_embedding_hnsw_cosine_idx;

drop trigger if exists process_memory_set_updated_at on writing_store.process_memory;
drop trigger if exists draft_chunks_set_updated_at on writing_store.draft_chunks;
drop trigger if exists writing_sections_set_updated_at on writing_store.writing_sections;
drop trigger if exists writing_projects_set_updated_at on writing_store.writing_projects;

drop table if exists writing_store.process_memory_embeddings;
drop table if exists writing_store.draft_chunk_embeddings;
drop table if exists writing_store.process_memory;
drop table if exists writing_store.draft_chunks;
drop table if exists writing_store.writing_sections;
drop table if exists writing_store.writing_projects;

drop function if exists writing_store.set_updated_at();
drop schema if exists writing_store;

