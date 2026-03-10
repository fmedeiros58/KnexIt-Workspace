-- ANM identity runtime supplementation
-- Continuous identification runtime independent from composer activation.
-- Includes persistent multimodal identity, source routing, consent and audit.

create schema if not exists knex_identity_runtime;

create extension if not exists vector with schema public;

create or replace function knex_identity_runtime.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- I. runtime configuration and source/stream control
create table if not exists knex_identity_runtime.identity_runtime_config (
  id bigserial primary key,
  runtime_key text not null unique,
  auto_start_enabled boolean not null default false,
  runtime_enabled boolean not null default false,
  runtime_paused boolean not null default false,
  runtime_state text not null default 'disabled',
  selected_source_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint identity_runtime_config_runtime_state_check check (
    runtime_state in ('disabled', 'enabled_idle', 'monitoring', 'tracking', 'validating', 'identified', 'conflict', 'paused', 'degraded')
  )
);

create table if not exists knex_identity_runtime.camera_sources (
  id bigserial primary key,
  source_key text not null unique,
  name text not null,
  source_type text not null default 'external',
  device_ref text,
  resolution text,
  fps integer not null default 30,
  priority integer not null default 100,
  is_active boolean not null default true,
  is_connected boolean not null default true,
  last_heartbeat_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint camera_sources_source_type_check check (source_type in ('local', 'external', 'virtual', 'ip'))
);

create table if not exists knex_identity_runtime.camera_source_assignments (
  id bigserial primary key,
  assignment_key text not null unique,
  source_key text not null references knex_identity_runtime.camera_sources(source_key) on delete cascade,
  context_key text not null,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists knex_identity_runtime.camera_stream_sessions (
  id bigserial primary key,
  stream_key text not null unique,
  source_key text not null references knex_identity_runtime.camera_sources(source_key) on delete cascade,
  status text not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint camera_stream_sessions_status_check check (status in ('active', 'paused', 'stopped', 'error'))
);

create table if not exists knex_identity_runtime.camera_stream_health (
  id bigserial primary key,
  stream_key text not null,
  source_key text not null,
  status text not null default 'active',
  fps_observed numeric(8,2) not null default 0.0,
  latency_ms integer not null default 0,
  dropped_frames integer not null default 0,
  health_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists knex_identity_runtime.active_streams (
  id bigserial primary key,
  stream_key text not null unique,
  source_key text not null references knex_identity_runtime.camera_sources(source_key) on delete cascade,
  runtime_key text not null,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists knex_identity_runtime.stream_processing_state (
  id bigserial primary key,
  stream_key text not null,
  source_key text not null,
  processing_state text not null default 'monitoring',
  frame_window_size integer not null default 1,
  last_cycle_at timestamptz,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists knex_identity_runtime.identity_source_routing (
  id bigserial primary key,
  route_key text not null unique,
  source_key text not null references knex_identity_runtime.camera_sources(source_key) on delete cascade,
  route_scope text not null,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- II. persistent multimodal identity runtime
create table if not exists knex_identity_runtime.identity_sessions (
  id bigserial primary key,
  session_key text not null unique,
  status text not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint identity_sessions_status_check check (status in ('active', 'paused', 'completed', 'aborted'))
);

create table if not exists knex_identity_runtime.identity_entities (
  id bigserial primary key,
  entity_key text not null unique,
  display_label text not null,
  entity_mode text not null default 'detection',
  confidence numeric(6,5) not null default 0.0,
  source_key text references knex_identity_runtime.camera_sources(source_key) on delete set null,
  voice_profile_key text,
  nominal_name text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint identity_entities_mode_check check (
    entity_mode in ('detection', 'tracking', 'reidentification', 'verification', 'nominal_identification')
  )
);

create table if not exists knex_identity_runtime.identity_face_embeddings (
  id bigserial primary key,
  entity_key text not null references knex_identity_runtime.identity_entities(entity_key) on delete cascade,
  embedding vector(768),
  model_name text,
  confidence numeric(6,5) not null default 0.0,
  window_started_at timestamptz,
  window_ended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists knex_identity_runtime.identity_voice_embeddings (
  id bigserial primary key,
  entity_key text not null references knex_identity_runtime.identity_entities(entity_key) on delete cascade,
  embedding vector(768),
  model_name text,
  confidence numeric(6,5) not null default 0.0,
  window_started_at timestamptz,
  window_ended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists knex_identity_runtime.identity_multimodal_links (
  id bigserial primary key,
  entity_key text not null references knex_identity_runtime.identity_entities(entity_key) on delete cascade,
  face_embedding_id bigint references knex_identity_runtime.identity_face_embeddings(id) on delete set null,
  voice_embedding_id bigint references knex_identity_runtime.identity_voice_embeddings(id) on delete set null,
  fused_confidence numeric(6,5) not null default 0.0,
  link_status text not null default 'linked',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint identity_multimodal_links_status_check check (link_status in ('linked', 'conflict', 'review'))
);

create table if not exists knex_identity_runtime.identity_presence_events (
  id bigserial primary key,
  session_key text not null,
  entity_key text not null references knex_identity_runtime.identity_entities(entity_key) on delete cascade,
  event_type text not null,
  source_key text references knex_identity_runtime.camera_sources(source_key) on delete set null,
  confidence numeric(6,5) not null default 0.0,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint identity_presence_events_type_check check (
    event_type in ('entered', 'exited', 'returned', 'present', 'lost', 'seen')
  )
);

create table if not exists knex_identity_runtime.identity_tracking_windows (
  id bigserial primary key,
  session_key text not null,
  entity_key text not null references knex_identity_runtime.identity_entities(entity_key) on delete cascade,
  source_key text references knex_identity_runtime.camera_sources(source_key) on delete set null,
  window_started_at timestamptz not null default now(),
  window_ended_at timestamptz,
  tracking_quality numeric(6,5) not null default 0.0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists knex_identity_runtime.identity_verification_events (
  id bigserial primary key,
  session_key text not null,
  entity_key text not null references knex_identity_runtime.identity_entities(entity_key) on delete cascade,
  verification_outcome text not null,
  confidence numeric(6,5) not null default 0.0,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint identity_verification_events_outcome_check check (
    verification_outcome in ('detection', 'tracking', 'reidentification', 'verification', 'identified', 'conflict', 'rejected', 'unknown')
  )
);

create table if not exists knex_identity_runtime.identity_device_streams (
  id bigserial primary key,
  session_key text not null,
  source_key text references knex_identity_runtime.camera_sources(source_key) on delete set null,
  stream_key text,
  mic_device_ref text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint identity_device_streams_status_check check (status in ('active', 'paused', 'stopped', 'error'))
);

create table if not exists knex_identity_runtime.identity_consent_registry (
  id bigserial primary key,
  consent_key text not null unique,
  session_key text,
  user_key text,
  purpose text not null,
  scope text not null,
  status text not null default 'granted',
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint identity_consent_registry_status_check check (status in ('granted', 'denied', 'revoked', 'expired'))
);

create table if not exists knex_identity_runtime.identity_audit_logs (
  id bigserial primary key,
  event_name text not null,
  payload jsonb not null default '{}'::jsonb,
  trace_id text,
  created_at timestamptz not null default now()
);

-- updated_at triggers
drop trigger if exists trg_set_updated_at_identity_runtime_config on knex_identity_runtime.identity_runtime_config;
create trigger trg_set_updated_at_identity_runtime_config
before update on knex_identity_runtime.identity_runtime_config
for each row execute function knex_identity_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_camera_sources on knex_identity_runtime.camera_sources;
create trigger trg_set_updated_at_camera_sources
before update on knex_identity_runtime.camera_sources
for each row execute function knex_identity_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_camera_source_assignments on knex_identity_runtime.camera_source_assignments;
create trigger trg_set_updated_at_camera_source_assignments
before update on knex_identity_runtime.camera_source_assignments
for each row execute function knex_identity_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_camera_stream_sessions on knex_identity_runtime.camera_stream_sessions;
create trigger trg_set_updated_at_camera_stream_sessions
before update on knex_identity_runtime.camera_stream_sessions
for each row execute function knex_identity_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_active_streams on knex_identity_runtime.active_streams;
create trigger trg_set_updated_at_active_streams
before update on knex_identity_runtime.active_streams
for each row execute function knex_identity_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_stream_processing_state on knex_identity_runtime.stream_processing_state;
create trigger trg_set_updated_at_stream_processing_state
before update on knex_identity_runtime.stream_processing_state
for each row execute function knex_identity_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_identity_source_routing on knex_identity_runtime.identity_source_routing;
create trigger trg_set_updated_at_identity_source_routing
before update on knex_identity_runtime.identity_source_routing
for each row execute function knex_identity_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_identity_sessions on knex_identity_runtime.identity_sessions;
create trigger trg_set_updated_at_identity_sessions
before update on knex_identity_runtime.identity_sessions
for each row execute function knex_identity_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_identity_entities on knex_identity_runtime.identity_entities;
create trigger trg_set_updated_at_identity_entities
before update on knex_identity_runtime.identity_entities
for each row execute function knex_identity_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_identity_multimodal_links on knex_identity_runtime.identity_multimodal_links;
create trigger trg_set_updated_at_identity_multimodal_links
before update on knex_identity_runtime.identity_multimodal_links
for each row execute function knex_identity_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_identity_device_streams on knex_identity_runtime.identity_device_streams;
create trigger trg_set_updated_at_identity_device_streams
before update on knex_identity_runtime.identity_device_streams
for each row execute function knex_identity_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_identity_consent_registry on knex_identity_runtime.identity_consent_registry;
create trigger trg_set_updated_at_identity_consent_registry
before update on knex_identity_runtime.identity_consent_registry
for each row execute function knex_identity_runtime.set_updated_at();

-- indexes
create index if not exists idx_identity_runtime_config_state on knex_identity_runtime.identity_runtime_config(runtime_state);
create index if not exists idx_camera_sources_active_priority on knex_identity_runtime.camera_sources(is_active, is_connected, priority);
create index if not exists idx_camera_stream_sessions_source_status on knex_identity_runtime.camera_stream_sessions(source_key, status);
create index if not exists idx_camera_stream_health_stream_created on knex_identity_runtime.camera_stream_health(stream_key, created_at desc);
create index if not exists idx_identity_source_routing_scope_active on knex_identity_runtime.identity_source_routing(route_scope, is_active);

create index if not exists idx_identity_entities_mode_confidence on knex_identity_runtime.identity_entities(entity_mode, confidence desc);
create index if not exists idx_identity_presence_events_entity_created on knex_identity_runtime.identity_presence_events(entity_key, created_at desc);
create index if not exists idx_identity_verification_events_entity_created on knex_identity_runtime.identity_verification_events(entity_key, created_at desc);
create index if not exists idx_identity_tracking_windows_entity_started on knex_identity_runtime.identity_tracking_windows(entity_key, window_started_at desc);
create index if not exists idx_identity_device_streams_session_status on knex_identity_runtime.identity_device_streams(session_key, status);
create index if not exists idx_identity_consent_registry_user_status on knex_identity_runtime.identity_consent_registry(user_key, status);
create index if not exists idx_identity_audit_logs_event_created on knex_identity_runtime.identity_audit_logs(event_name, created_at desc);

create index if not exists idx_identity_face_embeddings_entity_created on knex_identity_runtime.identity_face_embeddings(entity_key, created_at desc);
create index if not exists idx_identity_voice_embeddings_entity_created on knex_identity_runtime.identity_voice_embeddings(entity_key, created_at desc);

create index if not exists idx_identity_face_embeddings_vector
  on knex_identity_runtime.identity_face_embeddings
  using hnsw (embedding vector_cosine_ops);

create index if not exists idx_identity_voice_embeddings_vector
  on knex_identity_runtime.identity_voice_embeddings
  using hnsw (embedding vector_cosine_ops);

