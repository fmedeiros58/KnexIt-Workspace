-- RAG v2 pipeline schema (additivo, sem impacto no v1).
-- Inclui pagina por pagina, chunks versionados, embeddings, auditoria de run e memoria de processo.

create extension if not exists vector;

create schema if not exists rag_v2;

create or replace function rag_v2.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists rag_v2.documents (
  id bigserial primary key,
  user_id text,
  project_id text,
  filename text not null,
  mime text,
  sha256 text not null,
  parse_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rag_v2_documents_sha256_not_blank check (length(trim(sha256)) > 0)
);

create unique index if not exists rag_v2_documents_sha256_uk
  on rag_v2.documents(sha256);

create index if not exists rag_v2_documents_project_created_idx
  on rag_v2.documents(project_id, created_at desc);

drop trigger if exists rag_v2_documents_set_updated_at on rag_v2.documents;
create trigger rag_v2_documents_set_updated_at
before update on rag_v2.documents
for each row execute procedure rag_v2.set_updated_at();

create table if not exists rag_v2.document_pages (
  id bigserial primary key,
  doc_id bigint not null references rag_v2.documents(id) on delete cascade,
  page_number integer not null,
  text_raw text not null default '',
  text_norm text not null default '',
  has_ocr boolean not null default false,
  parse_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint rag_v2_document_pages_page_positive check (page_number > 0),
  constraint rag_v2_document_pages_doc_page_unique unique (doc_id, page_number)
);

create index if not exists rag_v2_document_pages_doc_page_idx
  on rag_v2.document_pages(doc_id, page_number);

create index if not exists rag_v2_document_pages_has_ocr_idx
  on rag_v2.document_pages(has_ocr);

create table if not exists rag_v2.chunks (
  id bigserial primary key,
  doc_id bigint not null references rag_v2.documents(id) on delete cascade,
  chunk_index integer not null,
  page_start integer,
  page_end integer,
  section_path text,
  text text not null,
  text_norm text not null,
  hash text not null,
  offsets jsonb not null default '[]'::jsonb,
  pipeline_version text not null default 'v2',
  search_vector tsvector generated always as (to_tsvector('simple', coalesce(text_norm, ''))) stored,
  created_at timestamptz not null default now(),
  constraint rag_v2_chunks_chunk_index_non_negative check (chunk_index >= 0),
  constraint rag_v2_chunks_page_range_valid check (page_end is null or page_start is null or page_end >= page_start),
  constraint rag_v2_chunks_hash_not_blank check (length(trim(hash)) > 0),
  constraint rag_v2_chunks_text_not_blank check (length(trim(text)) > 0),
  constraint rag_v2_chunks_doc_chunk_version_unique unique (doc_id, chunk_index, pipeline_version)
);

create index if not exists rag_v2_chunks_doc_pipeline_idx
  on rag_v2.chunks(doc_id, pipeline_version, chunk_index);

create index if not exists rag_v2_chunks_page_idx
  on rag_v2.chunks(doc_id, page_start, page_end);

create index if not exists rag_v2_chunks_hash_idx
  on rag_v2.chunks(doc_id, hash);

create index if not exists rag_v2_chunks_lexical_idx
  on rag_v2.chunks using gin (search_vector);

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'rag_v2'
      and table_name = 'embeddings'
  ) then
    execute $create_embeddings$
      create table rag_v2.embeddings (
        id bigserial primary key,
        chunk_id bigint not null references rag_v2.chunks(id) on delete cascade,
        embedding vector(768) not null,
        embedding_model text not null,
        embedding_version text not null default 'v2-default',
        created_at timestamptz not null default now(),
        constraint rag_v2_embeddings_chunk_version_unique unique (chunk_id, embedding_version)
      )
    $create_embeddings$;
  end if;
end $$;

create index if not exists rag_v2_embeddings_model_idx
  on rag_v2.embeddings(embedding_model, embedding_version);

create index if not exists rag_v2_embeddings_chunk_idx
  on rag_v2.embeddings(chunk_id);

drop index if exists rag_v2.rag_v2_embeddings_hnsw_cosine_idx;
create index if not exists rag_v2_embeddings_hnsw_cosine_idx
  on rag_v2.embeddings
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

create table if not exists rag_v2.retrieval_runs (
  id bigserial primary key,
  run_id text not null,
  request_id text not null,
  query_text text not null,
  query_hash text not null,
  pipeline_version text not null default 'v2',
  params jsonb not null default '{}'::jsonb,
  results jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint rag_v2_retrieval_runs_run_unique unique (run_id)
);

create index if not exists rag_v2_retrieval_runs_request_created_idx
  on rag_v2.retrieval_runs(request_id, created_at desc);

create index if not exists rag_v2_retrieval_runs_query_hash_idx
  on rag_v2.retrieval_runs(query_hash);

create table if not exists rag_v2.generation_runs (
  id bigserial primary key,
  run_id text not null,
  request_id text not null,
  pipeline_version text not null default 'v2',
  mode text not null,
  prompt_meta jsonb not null default '{}'::jsonb,
  token_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint rag_v2_generation_runs_mode_check check (mode in ('chat', 'write')),
  constraint rag_v2_generation_runs_run_unique unique (run_id)
);

create index if not exists rag_v2_generation_runs_request_created_idx
  on rag_v2.generation_runs(request_id, created_at desc);

create table if not exists rag_v2.citations (
  id bigserial primary key,
  run_id text not null,
  claim_id text not null,
  doc_id bigint references rag_v2.documents(id) on delete set null,
  chunk_id bigint references rag_v2.chunks(id) on delete set null,
  page_start integer,
  page_end integer,
  quote_span text,
  score double precision not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists rag_v2_citations_run_idx
  on rag_v2.citations(run_id, created_at desc);

create index if not exists rag_v2_citations_doc_chunk_idx
  on rag_v2.citations(doc_id, chunk_id);

create table if not exists rag_v2.process_memory (
  memory_id text primary key,
  conversation_id text not null,
  run_id text not null,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists rag_v2_process_memory_conversation_idx
  on rag_v2.process_memory(conversation_id, updated_at desc);

create index if not exists rag_v2_process_memory_run_idx
  on rag_v2.process_memory(run_id);

