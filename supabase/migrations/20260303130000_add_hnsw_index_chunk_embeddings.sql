-- HNSW index for vector retrieval on chunk embeddings.
-- Distance strategy definida explicitamente: cosine distance (<=>, vector_cosine_ops).

create extension if not exists vector;

drop index if exists vector_store.chunk_embeddings_embedding_cosine_idx;

create index if not exists chunk_embeddings_embedding_hnsw_cosine_idx
  on vector_store.chunk_embeddings
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

comment on index vector_store.chunk_embeddings_embedding_hnsw_cosine_idx is
  'HNSW index (cosine distance) for top-k retrieval over vector_store.chunk_embeddings.embedding';
