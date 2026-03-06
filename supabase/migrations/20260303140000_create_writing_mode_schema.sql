-- Writing mode schema (auditavel, versionavel e orientado a escrita longa).
-- Preserva o schema vetorial da Etapa 2 e adiciona dominio dedicado para escrita.

create extension if not exists vector;

create schema if not exists writing_store;

create or replace function writing_store.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists writing_store.writing_projects (
  id bigserial primary key,
  title text not null,
  description text,
  status text not null default 'draft',
  writing_mode text,
  style_profile text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint writing_projects_title_not_blank check (length(trim(title)) > 0),
  constraint writing_projects_status_check check (status in ('draft', 'in_progress', 'paused', 'completed', 'archived')),
  constraint writing_projects_writing_mode_not_blank check (writing_mode is null or length(trim(writing_mode)) > 0),
  constraint writing_projects_style_profile_not_blank check (style_profile is null or length(trim(style_profile)) > 0)
);

create table if not exists writing_store.writing_sections (
  id bigserial primary key,
  project_id bigint not null references writing_store.writing_projects(id) on delete cascade,
  parent_section_id bigint references writing_store.writing_sections(id) on delete set null,
  title text not null,
  objective text,
  section_order integer not null default 0,
  status text not null default 'planned',
  outline_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint writing_sections_title_not_blank check (length(trim(title)) > 0),
  constraint writing_sections_order_non_negative check (section_order >= 0),
  constraint writing_sections_status_check check (status in ('planned', 'drafting', 'review', 'done', 'archived')),
  constraint writing_sections_parent_not_self check (parent_section_id is null or parent_section_id <> id),
  constraint writing_sections_project_order_unique unique (project_id, section_order)
);

create table if not exists writing_store.draft_chunks (
  id bigserial primary key,
  project_id bigint not null references writing_store.writing_projects(id) on delete cascade,
  section_id bigint not null references writing_store.writing_sections(id) on delete cascade,
  chunk_order integer not null default 0,
  content text not null,
  source_type text not null,
  version integer not null default 1,
  char_count integer not null,
  token_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint draft_chunks_order_non_negative check (chunk_order >= 0),
  constraint draft_chunks_content_not_blank check (length(trim(content)) > 0),
  constraint draft_chunks_source_type_check check (source_type in ('generated', 'user_inserted', 'edited')),
  constraint draft_chunks_version_positive check (version >= 1),
  constraint draft_chunks_char_count_non_negative check (char_count >= 0),
  constraint draft_chunks_char_count_matches_content check (char_count = char_length(content)),
  constraint draft_chunks_token_count_non_negative check (token_count is null or token_count >= 0),
  constraint draft_chunks_project_section_order_version_unique unique (project_id, section_id, chunk_order, version)
);

create table if not exists writing_store.process_memory (
  id bigserial primary key,
  project_id bigint not null references writing_store.writing_projects(id) on delete cascade,
  section_id bigint references writing_store.writing_sections(id) on delete set null,
  memory_type text not null,
  title text not null,
  content text not null,
  priority integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint process_memory_type_check check (memory_type in ('rule', 'constraint', 'decision', 'definition', 'terminology', 'warning')),
  constraint process_memory_title_not_blank check (length(trim(title)) > 0),
  constraint process_memory_content_not_blank check (length(trim(content)) > 0),
  constraint process_memory_priority_range check (priority between 0 and 1000)
);

do $$
declare
  embedding_dimension integer := 768;
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'writing_store'
      and table_name = 'draft_chunk_embeddings'
  ) then
    execute format(
      $f$
      create table writing_store.draft_chunk_embeddings (
        id bigserial primary key,
        draft_chunk_id bigint not null unique references writing_store.draft_chunks(id) on delete cascade,
        embedding vector(%s) not null,
        embedding_model text not null,
        created_at timestamptz not null default now(),
        constraint draft_chunk_embeddings_model_not_blank check (length(trim(embedding_model)) > 0)
      )
      $f$,
      embedding_dimension
    );
  end if;

  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'writing_store'
      and table_name = 'process_memory_embeddings'
  ) then
    execute format(
      $f$
      create table writing_store.process_memory_embeddings (
        id bigserial primary key,
        process_memory_id bigint not null unique references writing_store.process_memory(id) on delete cascade,
        embedding vector(%s) not null,
        embedding_model text not null,
        created_at timestamptz not null default now(),
        constraint process_memory_embeddings_model_not_blank check (length(trim(embedding_model)) > 0)
      )
      $f$,
      embedding_dimension
    );
  end if;
end $$;

drop trigger if exists writing_projects_set_updated_at on writing_store.writing_projects;
create trigger writing_projects_set_updated_at
before update on writing_store.writing_projects
for each row execute procedure writing_store.set_updated_at();

drop trigger if exists writing_sections_set_updated_at on writing_store.writing_sections;
create trigger writing_sections_set_updated_at
before update on writing_store.writing_sections
for each row execute procedure writing_store.set_updated_at();

drop trigger if exists draft_chunks_set_updated_at on writing_store.draft_chunks;
create trigger draft_chunks_set_updated_at
before update on writing_store.draft_chunks
for each row execute procedure writing_store.set_updated_at();

drop trigger if exists process_memory_set_updated_at on writing_store.process_memory;
create trigger process_memory_set_updated_at
before update on writing_store.process_memory
for each row execute procedure writing_store.set_updated_at();

create index if not exists writing_projects_status_idx
  on writing_store.writing_projects(status);

create index if not exists writing_projects_updated_at_idx
  on writing_store.writing_projects(updated_at desc);

create index if not exists writing_projects_created_at_idx
  on writing_store.writing_projects(created_at desc);

create index if not exists writing_projects_metadata_gin_idx
  on writing_store.writing_projects using gin (metadata);

create index if not exists writing_sections_project_order_idx
  on writing_store.writing_sections(project_id, section_order);

create index if not exists writing_sections_parent_idx
  on writing_store.writing_sections(parent_section_id);

create index if not exists writing_sections_status_idx
  on writing_store.writing_sections(status);

create index if not exists writing_sections_updated_at_idx
  on writing_store.writing_sections(updated_at desc);

create index if not exists draft_chunks_project_section_order_idx
  on writing_store.draft_chunks(project_id, section_id, chunk_order, version desc);

create index if not exists draft_chunks_source_type_idx
  on writing_store.draft_chunks(source_type);

create index if not exists draft_chunks_updated_at_idx
  on writing_store.draft_chunks(updated_at desc);

create index if not exists draft_chunk_embeddings_model_idx
  on writing_store.draft_chunk_embeddings(embedding_model);

create index if not exists draft_chunk_embeddings_created_at_idx
  on writing_store.draft_chunk_embeddings(created_at desc);

create index if not exists process_memory_project_active_priority_idx
  on writing_store.process_memory(project_id, is_active, priority desc, updated_at desc);

create index if not exists process_memory_type_idx
  on writing_store.process_memory(memory_type);

create index if not exists process_memory_section_idx
  on writing_store.process_memory(section_id);

create index if not exists process_memory_updated_at_idx
  on writing_store.process_memory(updated_at desc);

create index if not exists process_memory_embeddings_model_idx
  on writing_store.process_memory_embeddings(embedding_model);

create index if not exists process_memory_embeddings_created_at_idx
  on writing_store.process_memory_embeddings(created_at desc);

comment on table writing_store.writing_projects is
  'Projeto de escrita longa com status, perfil de escrita e metadados auditaveis.';

comment on table writing_store.writing_sections is
  'Secoes estruturadas do projeto de escrita, com ordem previsivel e suporte hierarquico simples.';

comment on table writing_store.draft_chunks is
  'Blocos versionados de texto produzido por secao, base para continuidade e rastreabilidade.';

comment on table writing_store.draft_chunk_embeddings is
  'Embedding vetorial por chunk de texto (1:1), para recuperacao semantica de rascunho.';

comment on table writing_store.process_memory is
  'Memoria de processo ativa do projeto: decisoes, restricoes, terminologia e regras editoriais.';

comment on table writing_store.process_memory_embeddings is
  'Embedding vetorial por item de memoria de processo (1:1), para recuperacao semantica de contexto.';

