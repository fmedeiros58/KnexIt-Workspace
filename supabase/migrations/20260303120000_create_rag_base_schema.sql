-- Base RAG schema (auditavel, rastreavel e extensivel).
-- Mantem compatibilidade com estrutura existente e nao remove tabelas legadas.

create extension if not exists vector;

create schema if not exists vector_store;

create or replace function vector_store.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists vector_store.document_sources (
  id bigserial primary key,
  source_type text not null,
  source_path text not null,
  display_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_sources_source_unique unique (source_type, source_path)
);

create table if not exists vector_store.documents (
  id bigserial primary key,
  source_id bigint references vector_store.document_sources(id) on delete set null,
  source_type text not null,
  source_path text not null,
  original_filename text,
  mime_type text,
  content_hash text not null,
  title text,
  status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_status_check check (status in ('pending', 'processing', 'processed', 'failed', 'archived')),
  constraint documents_hash_not_blank check (length(trim(content_hash)) > 0),
  constraint documents_source_hash_unique unique (source_type, source_path, content_hash)
);

create table if not exists vector_store.document_chunks (
  id bigserial primary key,
  document_id bigint not null references vector_store.documents(id) on delete cascade,
  chunk_index integer not null,
  text text not null,
  token_count integer,
  char_start integer not null,
  char_end integer not null,
  created_at timestamptz not null default now(),
  constraint document_chunks_chunk_index_non_negative check (chunk_index >= 0),
  constraint document_chunks_token_count_non_negative check (token_count is null or token_count >= 0),
  constraint document_chunks_char_start_non_negative check (char_start >= 0),
  constraint document_chunks_char_range_valid check (char_end >= char_start),
  constraint document_chunks_text_not_blank check (length(trim(text)) > 0),
  constraint document_chunks_document_chunk_unique unique (document_id, chunk_index)
);

do $$
declare
  embedding_dimension integer := 768;
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'vector_store'
      and table_name = 'chunk_embeddings'
  ) then
    execute format(
      $f$
      create table vector_store.chunk_embeddings (
        id bigserial primary key,
        chunk_id bigint not null unique references vector_store.document_chunks(id) on delete cascade,
        embedding vector(%s) not null,
        embedding_model text not null,
        created_at timestamptz not null default now(),
        constraint chunk_embeddings_model_not_blank check (length(trim(embedding_model)) > 0)
      )
      $f$,
      embedding_dimension
    );
  end if;
end $$;

create table if not exists vector_store.ingestion_jobs (
  id bigserial primary key,
  document_id bigint references vector_store.documents(id) on delete set null,
  status text not null default 'queued',
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  constraint ingestion_jobs_status_check check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  constraint ingestion_jobs_time_range_check check (finished_at is null or started_at is null or finished_at >= started_at)
);

drop trigger if exists document_sources_set_updated_at on vector_store.document_sources;
create trigger document_sources_set_updated_at
before update on vector_store.document_sources
for each row execute procedure vector_store.set_updated_at();

drop trigger if exists documents_set_updated_at on vector_store.documents;
create trigger documents_set_updated_at
before update on vector_store.documents
for each row execute procedure vector_store.set_updated_at();

create index if not exists documents_status_idx
  on vector_store.documents(status);

create index if not exists documents_source_lookup_idx
  on vector_store.documents(source_type, source_path);

create unique index if not exists documents_content_hash_unique_idx
  on vector_store.documents(content_hash);

create index if not exists documents_created_at_idx
  on vector_store.documents(created_at desc);

create index if not exists documents_metadata_gin_idx
  on vector_store.documents using gin (metadata);

create index if not exists document_chunks_document_id_idx
  on vector_store.document_chunks(document_id);

create index if not exists document_chunks_char_range_idx
  on vector_store.document_chunks(document_id, char_start, char_end);

create index if not exists document_chunks_created_at_idx
  on vector_store.document_chunks(created_at desc);

create index if not exists chunk_embeddings_model_idx
  on vector_store.chunk_embeddings(embedding_model);

create index if not exists chunk_embeddings_created_at_idx
  on vector_store.chunk_embeddings(created_at desc);

-- Indice vetorial dedicado fica em migration especifica de HNSW:
-- supabase/migrations/20260303130000_add_hnsw_index_chunk_embeddings.sql

create index if not exists ingestion_jobs_status_created_idx
  on vector_store.ingestion_jobs(status, created_at desc);

create index if not exists ingestion_jobs_document_idx
  on vector_store.ingestion_jobs(document_id);

comment on table vector_store.document_sources is
  'Fontes catalogadas de ingestao (origem e caminho).';

comment on table vector_store.documents is
  'Documento canonico com hash e status de processamento.';

comment on table vector_store.document_chunks is
  'Chunks derivados de um documento, com rastreabilidade de posicao.';

comment on table vector_store.chunk_embeddings is
  'Embedding vetorial por chunk. Dimensao base operacional: 768 (alinhar com EMBEDDING_DIMENSION).';

comment on table vector_store.ingestion_jobs is
  'Rastreabilidade de execucoes de ingestao/processamento.';
