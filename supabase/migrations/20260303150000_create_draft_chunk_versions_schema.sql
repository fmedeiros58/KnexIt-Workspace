-- Draft chunk versioning schema for non-destructive editing in write workspace.
-- Keeps draft_chunks as current state and stores immutable snapshots in draft_chunk_versions.

create schema if not exists writing_store;

create table if not exists writing_store.draft_chunk_versions (
  id bigserial primary key,
  draft_chunk_id bigint not null references writing_store.draft_chunks(id) on delete cascade,
  version_number integer not null,
  previous_version_id bigint references writing_store.draft_chunk_versions(id) on delete set null,
  content_snapshot text not null,
  edit_source text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint draft_chunk_versions_version_positive check (version_number >= 1),
  constraint draft_chunk_versions_content_not_blank check (length(trim(content_snapshot)) > 0),
  constraint draft_chunk_versions_edit_source_check check (
    edit_source in ('generated', 'user_inserted', 'edited', 'user_edit', 'system_edit')
  ),
  constraint draft_chunk_versions_unique_per_chunk_version unique (draft_chunk_id, version_number),
  constraint draft_chunk_versions_previous_not_self check (previous_version_id is null or previous_version_id <> id)
);

create index if not exists draft_chunk_versions_chunk_version_idx
  on writing_store.draft_chunk_versions(draft_chunk_id, version_number desc);

create index if not exists draft_chunk_versions_previous_idx
  on writing_store.draft_chunk_versions(previous_version_id);

create index if not exists draft_chunk_versions_created_at_idx
  on writing_store.draft_chunk_versions(created_at desc);

create index if not exists draft_chunk_versions_edit_source_idx
  on writing_store.draft_chunk_versions(edit_source);

create index if not exists draft_chunk_versions_metadata_gin_idx
  on writing_store.draft_chunk_versions using gin (metadata);

insert into writing_store.draft_chunk_versions (
  draft_chunk_id,
  version_number,
  previous_version_id,
  content_snapshot,
  edit_source,
  metadata,
  created_at
)
select
  dc.id as draft_chunk_id,
  greatest(1, dc.version) as version_number,
  null as previous_version_id,
  dc.content as content_snapshot,
  dc.source_type as edit_source,
  jsonb_build_object(
    'origin', 'migration_backfill',
    'migration_id', '20260303150000_create_draft_chunk_versions_schema'
  ) as metadata,
  dc.created_at
from writing_store.draft_chunks dc
where not exists (
  select 1
  from writing_store.draft_chunk_versions dcv
  where dcv.draft_chunk_id = dc.id
    and dcv.version_number = greatest(1, dc.version)
);

comment on table writing_store.draft_chunk_versions is
  'Historico imutavel de versoes dos draft_chunks para edicao nao destrutiva e auditavel.';

