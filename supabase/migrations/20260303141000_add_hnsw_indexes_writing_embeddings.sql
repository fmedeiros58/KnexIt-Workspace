-- HNSW indices for writing mode embeddings.
-- Uses cosine distance for semantic retrieval consistency with RAG base.

create extension if not exists vector;

create index if not exists draft_chunk_embeddings_embedding_hnsw_cosine_idx
  on writing_store.draft_chunk_embeddings
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

create index if not exists process_memory_embeddings_embedding_hnsw_cosine_idx
  on writing_store.process_memory_embeddings
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

comment on index writing_store.draft_chunk_embeddings_embedding_hnsw_cosine_idx is
  'HNSW index (cosine distance) for semantic retrieval over writing_store.draft_chunk_embeddings.embedding';

comment on index writing_store.process_memory_embeddings_embedding_hnsw_cosine_idx is
  'HNSW index (cosine distance) for semantic retrieval over writing_store.process_memory_embeddings.embedding';

