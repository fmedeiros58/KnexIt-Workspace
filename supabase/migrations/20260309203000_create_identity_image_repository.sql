-- Identity image repository and image-linked embeddings.
-- Supports manual/assisted ingestion from the Identity Runtime panel.

create table if not exists knex_identity_runtime.identity_image_assets (
  id bigserial primary key,
  image_key text not null unique,
  entity_key text,
  source_key text,
  capture_view text not null default 'unknown',
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  image_hash_sha256 text not null,
  storage_bucket text not null,
  storage_path text not null unique,
  public_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint identity_image_assets_capture_view_check check (capture_view in ('main', 'left', 'front', 'right', 'gallery', 'unknown')),
  constraint identity_image_assets_size_bytes_check check (size_bytes >= 0)
);

create table if not exists knex_identity_runtime.identity_image_embeddings (
  id bigserial primary key,
  image_key text not null references knex_identity_runtime.identity_image_assets(image_key) on delete cascade,
  embedding vector(768),
  model_name text,
  embedding_source text not null default 'manual_ingest',
  confidence numeric(6,5) not null default 0.0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint identity_image_embeddings_confidence_check check (confidence >= 0 and confidence <= 1)
);

create table if not exists knex_identity_runtime.identity_capture_embeddings (
  id bigserial primary key,
  capture_key text not null unique,
  entity_key text,
  source_key text,
  capture_view text not null default 'unknown',
  embedding vector(768),
  model_name text,
  confidence numeric(6,5) not null default 0.0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint identity_capture_embeddings_capture_view_check check (capture_view in ('main', 'left', 'front', 'right', 'gallery', 'unknown')),
  constraint identity_capture_embeddings_confidence_check check (confidence >= 0 and confidence <= 1)
);

create table if not exists knex_identity_runtime.identity_embedding_matches (
  id bigserial primary key,
  match_key text not null unique,
  probe_capture_key text not null references knex_identity_runtime.identity_capture_embeddings(capture_key) on delete cascade,
  candidate_image_key text not null references knex_identity_runtime.identity_image_assets(image_key) on delete cascade,
  entity_key text,
  source_key text,
  similarity_score numeric(8,6) not null default 0.0,
  positive_threshold numeric(8,6) not null default 0.720000,
  match_status text not null default 'review',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint identity_embedding_matches_status_check check (match_status in ('positive', 'review', 'rejected')),
  constraint identity_embedding_matches_similarity_check check (similarity_score >= 0 and similarity_score <= 1),
  constraint identity_embedding_matches_threshold_check check (positive_threshold >= 0 and positive_threshold <= 1)
);

create table if not exists knex_identity_runtime.identity_interpretation_layers (
  id bigserial primary key,
  layer_key text not null unique,
  match_key text not null references knex_identity_runtime.identity_embedding_matches(match_key) on delete cascade,
  layer_name text not null,
  layer_result text not null default 'review',
  layer_score numeric(8,6) not null default 0.0,
  layer_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint identity_interpretation_layers_result_check check (layer_result in ('pass', 'fail', 'review')),
  constraint identity_interpretation_layers_score_check check (layer_score >= 0 and layer_score <= 1)
);

drop trigger if exists trg_set_updated_at_identity_image_assets on knex_identity_runtime.identity_image_assets;
create trigger trg_set_updated_at_identity_image_assets
before update on knex_identity_runtime.identity_image_assets
for each row execute function knex_identity_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_identity_image_embeddings on knex_identity_runtime.identity_image_embeddings;
create trigger trg_set_updated_at_identity_image_embeddings
before update on knex_identity_runtime.identity_image_embeddings
for each row execute function knex_identity_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_identity_capture_embeddings on knex_identity_runtime.identity_capture_embeddings;
create trigger trg_set_updated_at_identity_capture_embeddings
before update on knex_identity_runtime.identity_capture_embeddings
for each row execute function knex_identity_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_identity_embedding_matches on knex_identity_runtime.identity_embedding_matches;
create trigger trg_set_updated_at_identity_embedding_matches
before update on knex_identity_runtime.identity_embedding_matches
for each row execute function knex_identity_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_identity_interpretation_layers on knex_identity_runtime.identity_interpretation_layers;
create trigger trg_set_updated_at_identity_interpretation_layers
before update on knex_identity_runtime.identity_interpretation_layers
for each row execute function knex_identity_runtime.set_updated_at();

create index if not exists idx_identity_image_assets_entity_created
  on knex_identity_runtime.identity_image_assets(entity_key, created_at desc);

create index if not exists idx_identity_image_assets_source_created
  on knex_identity_runtime.identity_image_assets(source_key, created_at desc);

create index if not exists idx_identity_image_assets_capture_view_created
  on knex_identity_runtime.identity_image_assets(capture_view, created_at desc);

create index if not exists idx_identity_image_assets_hash
  on knex_identity_runtime.identity_image_assets(image_hash_sha256);

create index if not exists idx_identity_image_embeddings_image_created
  on knex_identity_runtime.identity_image_embeddings(image_key, created_at desc);

create index if not exists idx_identity_image_embeddings_vector
  on knex_identity_runtime.identity_image_embeddings
  using hnsw (embedding vector_cosine_ops);

create index if not exists idx_identity_capture_embeddings_entity_created
  on knex_identity_runtime.identity_capture_embeddings(entity_key, created_at desc);

create index if not exists idx_identity_capture_embeddings_source_created
  on knex_identity_runtime.identity_capture_embeddings(source_key, created_at desc);

create index if not exists idx_identity_capture_embeddings_vector
  on knex_identity_runtime.identity_capture_embeddings
  using hnsw (embedding vector_cosine_ops);

create index if not exists idx_identity_embedding_matches_probe_created
  on knex_identity_runtime.identity_embedding_matches(probe_capture_key, created_at desc);

create index if not exists idx_identity_embedding_matches_candidate_created
  on knex_identity_runtime.identity_embedding_matches(candidate_image_key, created_at desc);

create index if not exists idx_identity_embedding_matches_status_similarity
  on knex_identity_runtime.identity_embedding_matches(match_status, similarity_score desc, created_at desc);

create index if not exists idx_identity_interpretation_layers_match_created
  on knex_identity_runtime.identity_interpretation_layers(match_key, created_at desc);

create index if not exists idx_identity_interpretation_layers_name_result
  on knex_identity_runtime.identity_interpretation_layers(layer_name, layer_result, created_at desc);

-- Compatibility views for PostgREST deployments that expose only `public`.
create or replace view public.identity_image_assets as
select * from knex_identity_runtime.identity_image_assets;

create or replace view public.identity_image_embeddings as
select * from knex_identity_runtime.identity_image_embeddings;

create or replace view public.identity_capture_embeddings as
select * from knex_identity_runtime.identity_capture_embeddings;

create or replace view public.identity_embedding_matches as
select * from knex_identity_runtime.identity_embedding_matches;

create or replace view public.identity_interpretation_layers as
select * from knex_identity_runtime.identity_interpretation_layers;

grant usage on schema knex_identity_runtime to service_role;
grant select, insert, update, delete on all tables in schema knex_identity_runtime to service_role;
grant usage, select on all sequences in schema knex_identity_runtime to service_role;

alter default privileges in schema knex_identity_runtime
grant select, insert, update, delete on tables to service_role;

alter default privileges in schema knex_identity_runtime
grant usage, select on sequences to service_role;
