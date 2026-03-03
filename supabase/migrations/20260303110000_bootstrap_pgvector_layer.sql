-- Bootstrap dedicated vector layer (RAG) on Postgres.
-- Safe/idempotent: does not replace existing schemas or tables.

create extension if not exists vector;

create schema if not exists vector_store;

create table if not exists vector_store.rag_chunks (
  id bigserial primary key,
  namespace text not null default 'default',
  document_id text not null,
  chunk_id text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector,
  created_at timestamptz not null default now(),
  unique (namespace, document_id, chunk_id)
);

create index if not exists rag_chunks_namespace_document_idx
  on vector_store.rag_chunks(namespace, document_id);

create index if not exists rag_chunks_created_at_idx
  on vector_store.rag_chunks(created_at desc);

comment on table vector_store.rag_chunks is
  'Base RAG storage. Embedding dimension is governed by EMBEDDING_DIMENSION at application level.';
