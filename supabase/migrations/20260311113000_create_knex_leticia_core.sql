create extension if not exists vector;

create schema if not exists knex_leticia;

create or replace function knex_leticia.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists knex_leticia.person_nodes (
  person_node_id uuid primary key default gen_random_uuid(),
  display_name text not null,
  canonical_name text,
  kind text not null default 'person',
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint person_nodes_kind_check check (kind in ('person', 'system', 'organization', 'group')),
  constraint person_nodes_status_check check (status in ('active', 'archived'))
);

create unique index if not exists idx_leticia_person_nodes_canonical_name
  on knex_leticia.person_nodes(lower(coalesce(canonical_name, display_name)));

create table if not exists knex_leticia.person_identity_links (
  person_identity_link_id bigserial primary key,
  person_node_id uuid not null references knex_leticia.person_nodes(person_node_id) on delete cascade,
  identity_person_id text,
  identity_entity_key text,
  nominal_name text,
  source_system text not null default 'identity_runtime',
  confidence numeric(5,4) not null default 0.5000,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint person_identity_links_confidence_check check (confidence >= 0 and confidence <= 1)
);

create unique index if not exists idx_leticia_identity_links_person_personid
  on knex_leticia.person_identity_links(person_node_id, identity_person_id)
  where identity_person_id is not null;

create unique index if not exists idx_leticia_identity_links_person_entity
  on knex_leticia.person_identity_links(person_node_id, identity_entity_key)
  where identity_entity_key is not null;

create index if not exists idx_leticia_identity_links_identity_person
  on knex_leticia.person_identity_links(identity_person_id);

create index if not exists idx_leticia_identity_links_identity_entity
  on knex_leticia.person_identity_links(identity_entity_key);

create table if not exists knex_leticia.dialogue_turns (
  dialogue_turn_id uuid primary key default gen_random_uuid(),
  person_node_id uuid references knex_leticia.person_nodes(person_node_id) on delete set null,
  conversation_key text,
  role text not null,
  content text not null,
  locale text,
  source text not null default 'proactive_assistant',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint dialogue_turns_role_check check (role in ('user', 'assistant', 'system'))
);

create index if not exists idx_leticia_dialogue_turns_person_created
  on knex_leticia.dialogue_turns(person_node_id, created_at desc);

create index if not exists idx_leticia_dialogue_turns_conversation_created
  on knex_leticia.dialogue_turns(conversation_key, created_at desc);

create table if not exists knex_leticia.person_observations (
  person_observation_id uuid primary key default gen_random_uuid(),
  person_node_id uuid references knex_leticia.person_nodes(person_node_id) on delete set null,
  identity_person_id text,
  identity_entity_key text,
  observation_kind text not null,
  content text not null,
  confidence numeric(5,4) not null default 0.5000,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint person_observations_confidence_check check (confidence >= 0 and confidence <= 1)
);

create index if not exists idx_leticia_person_observations_person_created
  on knex_leticia.person_observations(person_node_id, created_at desc);

create index if not exists idx_leticia_person_observations_identity_created
  on knex_leticia.person_observations(identity_person_id, identity_entity_key, created_at desc);

create table if not exists knex_leticia.memory_candidates (
  memory_candidate_id uuid primary key default gen_random_uuid(),
  person_node_id uuid not null references knex_leticia.person_nodes(person_node_id) on delete cascade,
  source_turn_id uuid references knex_leticia.dialogue_turns(dialogue_turn_id) on delete set null,
  memory_kind text not null,
  candidate_text text not null,
  normalized_value text,
  confidence numeric(5,4) not null default 0.5000,
  status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memory_candidates_kind_check check (memory_kind in ('identity', 'preference', 'fact', 'relationship', 'context', 'profile')),
  constraint memory_candidates_status_check check (status in ('pending', 'accepted', 'rejected', 'merged')),
  constraint memory_candidates_confidence_check check (confidence >= 0 and confidence <= 1)
);

create index if not exists idx_leticia_memory_candidates_person_status
  on knex_leticia.memory_candidates(person_node_id, status, created_at desc);

create table if not exists knex_leticia.person_memory_items (
  person_memory_item_id uuid primary key default gen_random_uuid(),
  person_node_id uuid not null references knex_leticia.person_nodes(person_node_id) on delete cascade,
  source_candidate_id uuid references knex_leticia.memory_candidates(memory_candidate_id) on delete set null,
  memory_kind text not null,
  content text not null,
  normalized_value text,
  confidence numeric(5,4) not null default 0.5000,
  importance numeric(5,4) not null default 0.5000,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint person_memory_items_kind_check check (memory_kind in ('identity', 'preference', 'fact', 'relationship', 'context', 'profile')),
  constraint person_memory_items_status_check check (status in ('active', 'archived')),
  constraint person_memory_items_confidence_check check (confidence >= 0 and confidence <= 1),
  constraint person_memory_items_importance_check check (importance >= 0 and importance <= 1)
);

create index if not exists idx_leticia_person_memory_items_person_kind
  on knex_leticia.person_memory_items(person_node_id, memory_kind, updated_at desc);

create unique index if not exists idx_leticia_person_memory_items_person_normalized
  on knex_leticia.person_memory_items(person_node_id, memory_kind, normalized_value)
  where normalized_value is not null;

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'knex_leticia'
      and table_name = 'person_memory_embeddings'
  ) then
    execute $f$
      create table knex_leticia.person_memory_embeddings (
        person_memory_embedding_id bigserial primary key,
        person_memory_item_id uuid not null unique references knex_leticia.person_memory_items(person_memory_item_id) on delete cascade,
        embedding vector(768) not null,
        embedding_model text not null,
        created_at timestamptz not null default now()
      )
    $f$;
  end if;
end $$;

create index if not exists idx_leticia_person_memory_embeddings_model
  on knex_leticia.person_memory_embeddings(embedding_model, created_at desc);

create table if not exists knex_leticia.person_relationships (
  person_relationship_id uuid primary key default gen_random_uuid(),
  source_person_node_id uuid not null references knex_leticia.person_nodes(person_node_id) on delete cascade,
  target_person_node_id uuid not null references knex_leticia.person_nodes(person_node_id) on delete cascade,
  relation_type text not null,
  relation_score numeric(5,4) not null default 0.5000,
  source_memory_item_id uuid references knex_leticia.person_memory_items(person_memory_item_id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint person_relationships_score_check check (relation_score >= 0 and relation_score <= 1),
  constraint person_relationships_not_self_check check (source_person_node_id <> target_person_node_id)
);

create unique index if not exists idx_leticia_person_relationships_unique
  on knex_leticia.person_relationships(source_person_node_id, target_person_node_id, relation_type);

create index if not exists idx_leticia_person_relationships_target
  on knex_leticia.person_relationships(target_person_node_id, relation_type, updated_at desc);

create table if not exists knex_leticia.memory_consolidation_jobs (
  memory_consolidation_job_id uuid primary key default gen_random_uuid(),
  person_node_id uuid not null references knex_leticia.person_nodes(person_node_id) on delete cascade,
  memory_candidate_id uuid references knex_leticia.memory_candidates(memory_candidate_id) on delete cascade,
  job_status text not null default 'queued',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memory_consolidation_jobs_status_check check (job_status in ('queued', 'processing', 'done', 'failed'))
);

create index if not exists idx_leticia_memory_consolidation_jobs_person_status
  on knex_leticia.memory_consolidation_jobs(person_node_id, job_status, created_at desc);

drop trigger if exists trg_leticia_person_nodes_set_updated_at on knex_leticia.person_nodes;
create trigger trg_leticia_person_nodes_set_updated_at
before update on knex_leticia.person_nodes
for each row execute function knex_leticia.set_updated_at();

drop trigger if exists trg_leticia_person_identity_links_set_updated_at on knex_leticia.person_identity_links;
create trigger trg_leticia_person_identity_links_set_updated_at
before update on knex_leticia.person_identity_links
for each row execute function knex_leticia.set_updated_at();

drop trigger if exists trg_leticia_memory_candidates_set_updated_at on knex_leticia.memory_candidates;
create trigger trg_leticia_memory_candidates_set_updated_at
before update on knex_leticia.memory_candidates
for each row execute function knex_leticia.set_updated_at();

drop trigger if exists trg_leticia_person_memory_items_set_updated_at on knex_leticia.person_memory_items;
create trigger trg_leticia_person_memory_items_set_updated_at
before update on knex_leticia.person_memory_items
for each row execute function knex_leticia.set_updated_at();

drop trigger if exists trg_leticia_person_relationships_set_updated_at on knex_leticia.person_relationships;
create trigger trg_leticia_person_relationships_set_updated_at
before update on knex_leticia.person_relationships
for each row execute function knex_leticia.set_updated_at();

drop trigger if exists trg_leticia_memory_consolidation_jobs_set_updated_at on knex_leticia.memory_consolidation_jobs;
create trigger trg_leticia_memory_consolidation_jobs_set_updated_at
before update on knex_leticia.memory_consolidation_jobs
for each row execute function knex_leticia.set_updated_at();
