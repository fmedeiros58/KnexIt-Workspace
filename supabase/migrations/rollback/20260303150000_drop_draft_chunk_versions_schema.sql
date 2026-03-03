-- Manual rollback for draft chunk versioning schema.
-- Execute only when explicitly reverting chunk versioning in writing workspace.

drop table if exists writing_store.draft_chunk_versions;

