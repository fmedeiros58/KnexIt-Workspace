-- Writing summaries schema for explicit, incremental and auditable continuity.
-- Preserves existing writing_store/vector_store structures.

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

create unique index if not exists writing_sections_id_project_unique_idx
  on writing_store.writing_sections(id, project_id);

create table if not exists writing_store.section_summaries (
  id bigserial primary key,
  project_id bigint not null references writing_store.writing_projects(id) on delete cascade,
  section_id bigint not null unique,
  summary text not null,
  summary_version integer not null default 1,
  source_chunk_count integer not null default 0,
  last_chunk_id_processed bigint references writing_store.draft_chunks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint section_summaries_section_project_fk
    foreign key (section_id, project_id)
    references writing_store.writing_sections(id, project_id)
    on delete cascade,
  constraint section_summaries_summary_not_blank check (length(trim(summary)) > 0),
  constraint section_summaries_version_positive check (summary_version >= 1),
  constraint section_summaries_source_chunk_count_non_negative check (source_chunk_count >= 0)
);

create table if not exists writing_store.project_global_summaries (
  id bigserial primary key,
  project_id bigint not null unique references writing_store.writing_projects(id) on delete cascade,
  summary text not null,
  summary_version integer not null default 1,
  source_chunk_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_global_summaries_summary_not_blank check (length(trim(summary)) > 0),
  constraint project_global_summaries_version_positive check (summary_version >= 1),
  constraint project_global_summaries_source_chunk_count_non_negative check (source_chunk_count >= 0)
);

drop trigger if exists section_summaries_set_updated_at on writing_store.section_summaries;
create trigger section_summaries_set_updated_at
before update on writing_store.section_summaries
for each row execute procedure writing_store.set_updated_at();

drop trigger if exists project_global_summaries_set_updated_at on writing_store.project_global_summaries;
create trigger project_global_summaries_set_updated_at
before update on writing_store.project_global_summaries
for each row execute procedure writing_store.set_updated_at();

create index if not exists section_summaries_project_idx
  on writing_store.section_summaries(project_id);

create index if not exists section_summaries_updated_at_idx
  on writing_store.section_summaries(updated_at desc);

create index if not exists section_summaries_last_chunk_idx
  on writing_store.section_summaries(last_chunk_id_processed);

create index if not exists project_global_summaries_updated_at_idx
  on writing_store.project_global_summaries(updated_at desc);

comment on table writing_store.section_summaries is
  'Resumo incremental por secao para continuidade de escrita, versionado e auditavel.';

comment on table writing_store.project_global_summaries is
  'Resumo global incremental do projeto de escrita, versionado e auditavel.';

