-- ANM supplementation baseline
-- Runtime schema for long-form writing, semantic governance, reflection, inference
-- and future conversational persistence.

create schema if not exists knex_write_runtime;

create or replace function knex_write_runtime.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- A. core session
create table if not exists knex_write_runtime.write_sessions (
  id bigserial primary key,
  session_key text not null unique,
  user_id text,
  mode text not null default 'write',
  status text not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint write_sessions_mode_check check (mode in ('write', 'chat', 'hybrid')),
  constraint write_sessions_status_check check (status in ('active', 'paused', 'completed', 'archived'))
);

create table if not exists knex_write_runtime.write_documents (
  id bigserial primary key,
  session_id bigint not null references knex_write_runtime.write_sessions(id) on delete cascade,
  title text not null,
  objective text,
  status text not null default 'draft',
  language_code text not null default 'pt-BR',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint write_documents_status_check check (status in ('draft', 'in_progress', 'review', 'completed', 'archived'))
);

create table if not exists knex_write_runtime.write_sections (
  id bigserial primary key,
  document_id bigint not null references knex_write_runtime.write_documents(id) on delete cascade,
  parent_section_id bigint references knex_write_runtime.write_sections(id) on delete set null,
  section_key text,
  title text not null,
  objective text,
  section_order integer not null default 0,
  status text not null default 'planned',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint write_sections_status_check check (status in ('planned', 'drafting', 'review', 'done', 'archived'))
);

-- B. incremental generation core
create table if not exists knex_write_runtime.write_chunks (
  id bigserial primary key,
  document_id bigint not null references knex_write_runtime.write_documents(id) on delete cascade,
  section_id bigint references knex_write_runtime.write_sections(id) on delete set null,
  cycle_index integer not null default 0,
  chunk_order integer not null default 0,
  role text not null default 'assistant',
  content text not null,
  token_count integer,
  continuity_anchor text,
  source_type text not null default 'generated',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint write_chunks_source_type_check check (source_type in ('generated', 'edited', 'user_inserted'))
);

create table if not exists knex_write_runtime.write_generation_calls (
  id bigserial primary key,
  session_id bigint not null references knex_write_runtime.write_sessions(id) on delete cascade,
  document_id bigint not null references knex_write_runtime.write_documents(id) on delete cascade,
  section_id bigint references knex_write_runtime.write_sections(id) on delete set null,
  cycle_index integer not null default 0,
  provider text not null default 'vllm',
  model_name text not null,
  request_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  latency_ms integer not null default 0,
  status text not null default 'ok',
  prompt_digest text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint write_generation_calls_status_check check (status in ('ok', 'error', 'timeout', 'cancelled'))
);

create table if not exists knex_write_runtime.write_assemblies (
  id bigserial primary key,
  session_id bigint not null references knex_write_runtime.write_sessions(id) on delete cascade,
  document_id bigint not null references knex_write_runtime.write_documents(id) on delete cascade,
  strategy text not null default 'deterministic',
  chunk_count integer not null default 0,
  final_text text not null,
  token_count integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- C. process memory core
create table if not exists knex_write_runtime.process_memory_state (
  id bigserial primary key,
  session_id bigint not null unique references knex_write_runtime.write_sessions(id) on delete cascade,
  memory_version integer not null default 1,
  rolling_summary text,
  compressed_state jsonb not null default '{}'::jsonb,
  semantic_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists knex_write_runtime.rolling_summaries (
  id bigserial primary key,
  session_id bigint not null references knex_write_runtime.write_sessions(id) on delete cascade,
  cycle_index integer not null default 0,
  summary_text text not null,
  compressed_state jsonb not null default '{}'::jsonb,
  source_chunks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists knex_write_runtime.continuity_anchors (
  id bigserial primary key,
  session_id bigint not null references knex_write_runtime.write_sessions(id) on delete cascade,
  cycle_index integer not null default 0,
  anchor_text text not null,
  join_rule text,
  target_style text,
  source_chunk_id bigint references knex_write_runtime.write_chunks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists knex_write_runtime.memory_secondary_links (
  id bigserial primary key,
  session_id bigint not null references knex_write_runtime.write_sessions(id) on delete cascade,
  source_entity_type text not null,
  source_entity_id bigint not null,
  target_entity_type text not null,
  target_entity_id bigint not null,
  relation_type text not null,
  relation_score numeric(5,4) not null default 0.0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- D. semantic core
create table if not exists knex_write_runtime.semantic_states (
  id bigserial primary key,
  session_id bigint not null references knex_write_runtime.write_sessions(id) on delete cascade,
  cycle_index integer not null default 0,
  next_intent text,
  semantic_direction text,
  continuity_rule text,
  state_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists knex_write_runtime.semantic_intents (
  id bigserial primary key,
  session_id bigint not null references knex_write_runtime.write_sessions(id) on delete cascade,
  intent_label text not null,
  intent_status text not null default 'active',
  first_cycle integer not null default 0,
  last_cycle integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint semantic_intents_status_check check (intent_status in ('active', 'completed', 'blocked', 'deferred'))
);

create table if not exists knex_write_runtime.concept_coverage (
  id bigserial primary key,
  session_id bigint not null references knex_write_runtime.write_sessions(id) on delete cascade,
  concept text not null,
  coverage_score numeric(5,4) not null default 0.0,
  last_cycle integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists knex_write_runtime.redundancy_registry (
  id bigserial primary key,
  session_id bigint not null references knex_write_runtime.write_sessions(id) on delete cascade,
  cycle_index integer not null default 0,
  redundancy_score numeric(5,4) not null default 0.0,
  redundancy_flag text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists knex_write_runtime.transition_rules (
  id bigserial primary key,
  session_id bigint not null references knex_write_runtime.write_sessions(id) on delete cascade,
  rule_name text not null,
  rule_definition text not null,
  priority integer not null default 100,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- E. reflective core
create table if not exists knex_write_runtime.reflective_reviews (
  id bigserial primary key,
  session_id bigint not null references knex_write_runtime.write_sessions(id) on delete cascade,
  cycle_index integer not null default 0,
  review_status text not null default 'ok',
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reflective_reviews_status_check check (review_status in ('ok', 'warning', 'critical'))
);

create table if not exists knex_write_runtime.reflective_findings (
  id bigserial primary key,
  review_id bigint not null references knex_write_runtime.reflective_reviews(id) on delete cascade,
  finding_type text not null,
  severity text not null default 'medium',
  description text not null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists knex_write_runtime.cross_text_comparisons (
  id bigserial primary key,
  review_id bigint not null references knex_write_runtime.reflective_reviews(id) on delete cascade,
  chunk_id_a bigint references knex_write_runtime.write_chunks(id) on delete set null,
  chunk_id_b bigint references knex_write_runtime.write_chunks(id) on delete set null,
  similarity_score numeric(5,4) not null default 0.0,
  contradiction_flag boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists knex_write_runtime.precision_alerts (
  id bigserial primary key,
  review_id bigint not null references knex_write_runtime.reflective_reviews(id) on delete cascade,
  alert_code text not null,
  alert_message text not null,
  severity text not null default 'medium',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists knex_write_runtime.coherence_alerts (
  id bigserial primary key,
  review_id bigint not null references knex_write_runtime.reflective_reviews(id) on delete cascade,
  alert_code text not null,
  alert_message text not null,
  severity text not null default 'medium',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- F. inferential core
create table if not exists knex_write_runtime.inference_suggestions (
  id bigserial primary key,
  session_id bigint not null references knex_write_runtime.write_sessions(id) on delete cascade,
  cycle_index integer not null default 0,
  suggestion_text text not null,
  priority integer not null default 50,
  status text not null default 'open',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inference_suggestions_status_check check (status in ('open', 'accepted', 'discarded', 'deferred'))
);

create table if not exists knex_write_runtime.inference_gaps (
  id bigserial primary key,
  session_id bigint not null references knex_write_runtime.write_sessions(id) on delete cascade,
  cycle_index integer not null default 0,
  gap_label text not null,
  gap_description text,
  severity text not null default 'medium',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists knex_write_runtime.expansion_opportunities (
  id bigserial primary key,
  session_id bigint not null references knex_write_runtime.write_sessions(id) on delete cascade,
  cycle_index integer not null default 0,
  opportunity_label text not null,
  rationale text,
  expected_gain numeric(5,4) not null default 0.0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists knex_write_runtime.latent_topics (
  id bigserial primary key,
  session_id bigint not null references knex_write_runtime.write_sessions(id) on delete cascade,
  topic_label text not null,
  activation_score numeric(5,4) not null default 0.0,
  last_cycle integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- G. future conversational core
create table if not exists knex_write_runtime.dialogue_sessions (
  id bigserial primary key,
  write_session_id bigint not null unique references knex_write_runtime.write_sessions(id) on delete cascade,
  dialogue_mode text not null default 'assistive',
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dialogue_sessions_status_check check (status in ('active', 'paused', 'ended', 'archived'))
);

create table if not exists knex_write_runtime.dialogue_state (
  id bigserial primary key,
  dialogue_session_id bigint not null unique references knex_write_runtime.dialogue_sessions(id) on delete cascade,
  active_theme text,
  open_subtopics jsonb not null default '[]'::jsonb,
  discourse_tone text,
  state_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists knex_write_runtime.conversation_summary (
  id bigserial primary key,
  dialogue_session_id bigint not null references knex_write_runtime.dialogue_sessions(id) on delete cascade,
  turn_index integer not null default 0,
  summary_text text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists knex_write_runtime.turn_memory (
  id bigserial primary key,
  dialogue_session_id bigint not null references knex_write_runtime.dialogue_sessions(id) on delete cascade,
  turn_index integer not null default 0,
  role text not null default 'assistant',
  content text not null,
  intent_label text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint turn_memory_role_check check (role in ('user', 'assistant', 'system', 'tool'))
);

create table if not exists knex_write_runtime.user_profile_memory (
  id bigserial primary key,
  user_id text not null,
  profile_key text not null,
  profile_value jsonb not null default '{}'::jsonb,
  confidence numeric(5,4) not null default 0.0,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, profile_key)
);

-- H. observability core
create table if not exists knex_write_runtime.llm_call_logs (
  id bigserial primary key,
  session_id bigint references knex_write_runtime.write_sessions(id) on delete cascade,
  request_id text,
  cycle_index integer not null default 0,
  provider text not null default 'vllm',
  model_name text not null,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  latency_ms integer not null default 0,
  status text not null default 'ok',
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint llm_call_logs_status_check check (status in ('ok', 'error', 'timeout', 'cancelled'))
);

create table if not exists knex_write_runtime.token_usage_logs (
  id bigserial primary key,
  session_id bigint references knex_write_runtime.write_sessions(id) on delete cascade,
  request_id text,
  scope text not null default 'orchestration',
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists knex_write_runtime.latency_metrics (
  id bigserial primary key,
  session_id bigint references knex_write_runtime.write_sessions(id) on delete cascade,
  request_id text,
  metric_name text not null,
  metric_ms integer not null default 0,
  cycle_index integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists knex_write_runtime.orchestration_events (
  id bigserial primary key,
  session_id bigint references knex_write_runtime.write_sessions(id) on delete cascade,
  request_id text,
  event_name text not null,
  cycle_index integer not null default 0,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists knex_write_runtime.module_decisions (
  id bigserial primary key,
  session_id bigint references knex_write_runtime.write_sessions(id) on delete cascade,
  request_id text,
  module_name text not null,
  decision_name text not null,
  decision_payload jsonb not null default '{}'::jsonb,
  cycle_index integer not null default 0,
  created_at timestamptz not null default now()
);

-- updated_at triggers
drop trigger if exists trg_set_updated_at_write_sessions on knex_write_runtime.write_sessions;
create trigger trg_set_updated_at_write_sessions
before update on knex_write_runtime.write_sessions
for each row execute function knex_write_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_write_documents on knex_write_runtime.write_documents;
create trigger trg_set_updated_at_write_documents
before update on knex_write_runtime.write_documents
for each row execute function knex_write_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_write_sections on knex_write_runtime.write_sections;
create trigger trg_set_updated_at_write_sections
before update on knex_write_runtime.write_sections
for each row execute function knex_write_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_write_chunks on knex_write_runtime.write_chunks;
create trigger trg_set_updated_at_write_chunks
before update on knex_write_runtime.write_chunks
for each row execute function knex_write_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_write_assemblies on knex_write_runtime.write_assemblies;
create trigger trg_set_updated_at_write_assemblies
before update on knex_write_runtime.write_assemblies
for each row execute function knex_write_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_process_memory_state on knex_write_runtime.process_memory_state;
create trigger trg_set_updated_at_process_memory_state
before update on knex_write_runtime.process_memory_state
for each row execute function knex_write_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_continuity_anchors on knex_write_runtime.continuity_anchors;
create trigger trg_set_updated_at_continuity_anchors
before update on knex_write_runtime.continuity_anchors
for each row execute function knex_write_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_semantic_states on knex_write_runtime.semantic_states;
create trigger trg_set_updated_at_semantic_states
before update on knex_write_runtime.semantic_states
for each row execute function knex_write_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_semantic_intents on knex_write_runtime.semantic_intents;
create trigger trg_set_updated_at_semantic_intents
before update on knex_write_runtime.semantic_intents
for each row execute function knex_write_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_concept_coverage on knex_write_runtime.concept_coverage;
create trigger trg_set_updated_at_concept_coverage
before update on knex_write_runtime.concept_coverage
for each row execute function knex_write_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_transition_rules on knex_write_runtime.transition_rules;
create trigger trg_set_updated_at_transition_rules
before update on knex_write_runtime.transition_rules
for each row execute function knex_write_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_reflective_reviews on knex_write_runtime.reflective_reviews;
create trigger trg_set_updated_at_reflective_reviews
before update on knex_write_runtime.reflective_reviews
for each row execute function knex_write_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_inference_suggestions on knex_write_runtime.inference_suggestions;
create trigger trg_set_updated_at_inference_suggestions
before update on knex_write_runtime.inference_suggestions
for each row execute function knex_write_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_latent_topics on knex_write_runtime.latent_topics;
create trigger trg_set_updated_at_latent_topics
before update on knex_write_runtime.latent_topics
for each row execute function knex_write_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_dialogue_sessions on knex_write_runtime.dialogue_sessions;
create trigger trg_set_updated_at_dialogue_sessions
before update on knex_write_runtime.dialogue_sessions
for each row execute function knex_write_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_dialogue_state on knex_write_runtime.dialogue_state;
create trigger trg_set_updated_at_dialogue_state
before update on knex_write_runtime.dialogue_state
for each row execute function knex_write_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_turn_memory on knex_write_runtime.turn_memory;
create trigger trg_set_updated_at_turn_memory
before update on knex_write_runtime.turn_memory
for each row execute function knex_write_runtime.set_updated_at();

drop trigger if exists trg_set_updated_at_user_profile_memory on knex_write_runtime.user_profile_memory;
create trigger trg_set_updated_at_user_profile_memory
before update on knex_write_runtime.user_profile_memory
for each row execute function knex_write_runtime.set_updated_at();

-- operational indexes
create index if not exists idx_knex_write_runtime_write_documents_session
  on knex_write_runtime.write_documents(session_id, status);
create index if not exists idx_knex_write_runtime_write_sections_document
  on knex_write_runtime.write_sections(document_id, section_order);
create index if not exists idx_knex_write_runtime_write_chunks_document_cycle
  on knex_write_runtime.write_chunks(document_id, cycle_index, chunk_order);
create index if not exists idx_knex_write_runtime_write_generation_calls_session_cycle
  on knex_write_runtime.write_generation_calls(session_id, cycle_index);
create index if not exists idx_knex_write_runtime_write_assemblies_document_created
  on knex_write_runtime.write_assemblies(document_id, created_at desc);

create index if not exists idx_knex_write_runtime_rolling_summaries_session_cycle
  on knex_write_runtime.rolling_summaries(session_id, cycle_index);
create index if not exists idx_knex_write_runtime_continuity_anchors_session_cycle
  on knex_write_runtime.continuity_anchors(session_id, cycle_index);

create index if not exists idx_knex_write_runtime_semantic_states_session_cycle
  on knex_write_runtime.semantic_states(session_id, cycle_index);
create index if not exists idx_knex_write_runtime_semantic_intents_session_status
  on knex_write_runtime.semantic_intents(session_id, intent_status);
create index if not exists idx_knex_write_runtime_concept_coverage_session_score
  on knex_write_runtime.concept_coverage(session_id, coverage_score desc);
create index if not exists idx_knex_write_runtime_redundancy_registry_session_cycle
  on knex_write_runtime.redundancy_registry(session_id, cycle_index);
create index if not exists idx_knex_write_runtime_transition_rules_session_active_priority
  on knex_write_runtime.transition_rules(session_id, is_active, priority);

create index if not exists idx_knex_write_runtime_reflective_reviews_session_cycle
  on knex_write_runtime.reflective_reviews(session_id, cycle_index);
create index if not exists idx_knex_write_runtime_reflective_findings_review_severity
  on knex_write_runtime.reflective_findings(review_id, severity);
create index if not exists idx_knex_write_runtime_cross_text_comparisons_review
  on knex_write_runtime.cross_text_comparisons(review_id);
create index if not exists idx_knex_write_runtime_precision_alerts_review_severity
  on knex_write_runtime.precision_alerts(review_id, severity);
create index if not exists idx_knex_write_runtime_coherence_alerts_review_severity
  on knex_write_runtime.coherence_alerts(review_id, severity);

create index if not exists idx_knex_write_runtime_inference_suggestions_session_cycle_status
  on knex_write_runtime.inference_suggestions(session_id, cycle_index, status);
create index if not exists idx_knex_write_runtime_inference_gaps_session_cycle
  on knex_write_runtime.inference_gaps(session_id, cycle_index);
create index if not exists idx_knex_write_runtime_expansion_opportunities_session_cycle
  on knex_write_runtime.expansion_opportunities(session_id, cycle_index);
create index if not exists idx_knex_write_runtime_latent_topics_session_activation
  on knex_write_runtime.latent_topics(session_id, activation_score desc);

create index if not exists idx_knex_write_runtime_conversation_summary_session_turn
  on knex_write_runtime.conversation_summary(dialogue_session_id, turn_index);
create index if not exists idx_knex_write_runtime_turn_memory_session_turn
  on knex_write_runtime.turn_memory(dialogue_session_id, turn_index);
create index if not exists idx_knex_write_runtime_user_profile_memory_user
  on knex_write_runtime.user_profile_memory(user_id);

create index if not exists idx_knex_write_runtime_llm_call_logs_session_cycle_created
  on knex_write_runtime.llm_call_logs(session_id, cycle_index, created_at desc);
create index if not exists idx_knex_write_runtime_token_usage_logs_session_created
  on knex_write_runtime.token_usage_logs(session_id, created_at desc);
create index if not exists idx_knex_write_runtime_latency_metrics_session_metric_created
  on knex_write_runtime.latency_metrics(session_id, metric_name, created_at desc);
create index if not exists idx_knex_write_runtime_orchestration_events_session_event_created
  on knex_write_runtime.orchestration_events(session_id, event_name, created_at desc);
create index if not exists idx_knex_write_runtime_module_decisions_session_module_created
  on knex_write_runtime.module_decisions(session_id, module_name, created_at desc);
