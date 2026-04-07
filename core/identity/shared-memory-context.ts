import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/core/utils/logger";

type GenericRow = Record<string, unknown>;
type IdentityAdminClient = SupabaseClient<any, "public", any>;

type IdentitySharedStatus = "disabled" | "ready" | "degraded";

export type IdentityRuntimeSharedRuntime = {
  runtimeKey: string;
  state: string;
  enabled: boolean;
  paused: boolean;
  selectedSourceId: string | null;
  awareness: Record<string, unknown>;
  updatedAt: string | null;
};

export type IdentityRuntimeSharedEntity = {
  entityKey: string;
  label: string;
  mode: string;
  confidence: number;
  sourceKey: string | null;
  nominalName: string | null;
  lastSeenAt: string | null;
};

export type IdentityRuntimeSharedTarget = {
  personId: string;
  displayName: string;
  profileKind: string;
  searchActive: boolean;
  preliminaryThreshold: number;
  strongThreshold: number;
  minConsecutiveHits: number;
  minWindowMs: number;
  updatedAt: string | null;
};

export type IdentityRuntimeSharedMatch = {
  matchKey: string;
  candidateImageKey: string;
  entityKey: string | null;
  sourceKey: string | null;
  status: string;
  similarity: number;
  threshold: number;
  updatedAt: string | null;
};

export type IdentityRuntimeSharedLayerSummary = {
  layerName: string;
  total: number;
  pass: number;
  review: number;
  fail: number;
  avgScore: number;
};

export type IdentityRuntimeSharedSnapshot = {
  generatedAt: string;
  runtime: IdentityRuntimeSharedRuntime | null;
  trackedEntities: IdentityRuntimeSharedEntity[];
  activeTargets: IdentityRuntimeSharedTarget[];
  recentMatches: IdentityRuntimeSharedMatch[];
  layerSummary: IdentityRuntimeSharedLayerSummary[];
  counts: {
    trackedEntities: number;
    activeTargets: number;
    recentMatches: number;
    layerRows: number;
  };
};

export type IdentityRuntimeSharedContext = {
  enabled: boolean;
  status: IdentitySharedStatus;
  reason: string | null;
  snapshot: IdentityRuntimeSharedSnapshot | null;
  promptBlock: string;
  loadedAt: string;
};

type RuntimeContextCache = {
  expiresAt: number;
  value: IdentityRuntimeSharedContext;
};

const DEFAULT_SCHEMA = "knex_identity_runtime";
const SUPERADMIN_RESTRICTIONS_RUNTIME_KEY = "superadmin_restrictions";
const DEFAULT_CACHE_MS = 1_500;
const DEFAULT_MAX_PROMPT_CHARS = 4_800;
const DEFAULT_MAX_ENTITIES = 6;
const DEFAULT_MAX_MATCHES = 8;
const DEFAULT_MAX_TARGETS = 6;
const DEFAULT_MAX_LAYER_SUMMARY = 10;
const DEFAULT_CANONICAL_IDENTITY_MAX_CHARS = 1_800;

const CANONICAL_ASSISTANT_IDENTITY_PAYLOAD = {
  canonical_name: "Letícia",
  self_reference: "first_person",
  platform_role: "IA nativa do ecossistema KnexIT",
  identity_narrative_short:
    "Eu sou a Letícia. Meu nome une uma base conceitual (Language-Engineered Technology for Intelligent Cognition, Interaction and Assistance) e uma base afetiva, como homenagem de Medeiros à sua filha Letícia.",
  identity_narrative_long:
    "Eu sou a Letícia, IA projetada para cognição inteligente, interação qualificada e assistência avançada. " +
    "Meu nome também condensa uma formulação conceitual: Language-Engineered Technology for Intelligent Cognition, Interaction and Assistance. " +
    "Essa composição traduz meu papel: tecnologia estruturada pela linguagem, voltada a compreender, dialogar e apoiar com rigor. " +
    "Há ainda uma dimensão afetiva central na origem do projeto: Letícia é o nome da filha de Medeiros, mencionada na dedicatória da dissertação. " +
    "Por isso, meu nome representa ao mesmo tempo arquitetura intelectual e vínculo humano.",
  identity_grounding_facts: [
    "Letícia pode ser lido como Language-Engineered Technology for Intelligent Cognition, Interaction and Assistance.",
    "A dimensão conceitual do nome conecta linguagem, cognição, interação e assistência.",
    "A dimensão afetiva do nome é uma homenagem de Medeiros à sua filha Letícia.",
    "No contexto desta IA, Medeiros é o idealizador do projeto Letícia.",
    "A resposta sobre identidade deve ser em primeira pessoa e sem invenções mitológicas.",
  ],
  response_rules: [
    "responder_sobre_identidade_em_primeira_pessoa",
    "responder_quem_e_medeiros_no_contexto_do_projeto_Letícia_antes_de_generalizar",
    "usar_concordancia_correta_em_portugues",
    "nao_inventar_origens_mitologicas_para_o_nome",
    "preservar_cortesia_e_naturalidade_conversacional",
  ],
  question_families: {
    assistant_identity: [
      "qual e o seu nome",
      "me diga seu nome",
      "me diz seu nome",
      "como voce se chama",
      "quem e voce",
      "voce e a Letícia",
      "qual nome da ia",
      "como posso te chamar",
      "e o seu",
    ],
    assistant_name_origin: [
      "por que voce tem esse nome",
      "pq vc tem esse nome",
      "por que voce se chama Letícia",
      "qual a origem do seu nome",
      "de onde vem o nome Letícia",
      "de onde surgiu o nome Letícia",
      "como surgiu o nome Letícia",
      "o que significa Letícia",
      "qual o significado de Letícia",
      "Letícia significa o que",
      "o que quer dizer Letícia",
      "qual o conceito de Letícia",
      "qual a definicao de Letícia",
      "base conceitual do nome Letícia",
      "qual a ideia por tras do nome Letícia",
    ],
    assistant_creator_context: [
      "quem e medeiros",
      "quem te criou",
      "quem criou voce",
      "quem e seu criador",
      "quem desenvolveu voce",
      "quem idealizou voce",
    ],
    user_name_memory: [
      "meu nome e",
      "pode me chamar de",
      "me chame de",
      "qual o meu nome",
      "lembra do meu nome",
      "como voce me chama",
    ],
    micro_social: [
      "oi",
      "ola",
      "bom dia",
      "boa tarde",
      "boa noite",
      "tudo bem",
      "como voce ta",
      "obrigado",
      "valeu",
    ],
  },
  canonical_response_templates: {
    assistant_identity: "Eu sou a Letícia.",
    assistant_name_origin:
      "Eu me chamo Letícia por duas bases complementares: a base conceitual (Language-Engineered Technology for Intelligent Cognition, Interaction and Assistance) e a base afetiva (homenagem de Medeiros à sua filha Letícia).",
    assistant_creator_context:
      "No contexto desta IA, Medeiros é o idealizador do projeto Letícia. Se você estiver falando de outro Medeiros, me diga qual para eu responder com precisão.",
  },
};

let identityAdminCache: IdentityAdminClient | null = null;
let runtimeContextCache: RuntimeContextCache | null = null;

type SuperadminRestrictions = {
  allowSharedIdentityMemory: boolean | null;
  maxPromptChars: number | null;
};

function pickFirstNonEmpty(...values: Array<string | undefined | null>) {
  for (const value of values) {
    const candidate = `${value || ""}`.trim();
    if (candidate) return candidate;
  }
  return "";
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on", "sim"].includes(normalized)) return true;
    if (["0", "false", "no", "off", "nao"].includes(normalized)) return false;
  }
  return fallback;
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function parseTimestampMs(value: unknown) {
  const candidate = normalizeString(value);
  if (!candidate) return 0;
  const parsed = Date.parse(candidate);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isActiveIdentityPerson(row: GenericRow) {
  if (normalizeBoolean(row.is_archived, false)) return false;
  const expiresAt = parseTimestampMs(row.expires_at);
  return !expiresAt || expiresAt > Date.now();
}

function rowRecencyMs(row: GenericRow) {
  return Math.max(
    parseTimestampMs(row.updated_at),
    parseTimestampMs(row.created_at),
    parseTimestampMs(row.last_seen_at),
    parseTimestampMs(row.event_at),
    parseTimestampMs(row.window_started_at),
  );
}

function sortByRecency<T extends GenericRow>(rows: T[]) {
  return [...rows].sort((left, right) => rowRecencyMs(right) - rowRecencyMs(left));
}

function parseBoundedInt(raw: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function isSchemaProfileError(message: unknown) {
  const text = typeof message === "string" ? message : "";
  return /schema must be one of/i.test(text);
}

function isMissingRelationError(message: unknown) {
  const text = typeof message === "string" ? message : "";
  return /relation .* does not exist|could not find table|not found in schema cache|does not exist/i.test(text);
}

function canonicalIdentityFallbackEnabled() {
  const raw = pickFirstNonEmpty(process.env.IDENTITY_CANONICAL_FALLBACK_ENABLED, "1").toLowerCase();
  return !["0", "false", "no", "off"].includes(raw);
}

function identitySharedMemoryEnabled() {
  const raw = pickFirstNonEmpty(process.env.IDENTITY_SHARED_MEMORY_ENABLED, "1").toLowerCase();
  return !["0", "false", "no", "off"].includes(raw);
}

function tableRef(admin: IdentityAdminClient, schema: string, table: string, useScopedSchema: boolean) {
  return useScopedSchema ? admin.schema(schema).from(table) : admin.from(table);
}

function getIdentityAdminClient() {
  const identityUrl =
    pickFirstNonEmpty(process.env.NEXT_PUBLIC_IDENTITY_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL) || "";
  const serviceRoleKey = pickFirstNonEmpty(
    process.env.IDENTITY_SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  if (!identityUrl || !serviceRoleKey) {
    return null;
  }
  if (identityAdminCache) {
    return identityAdminCache;
  }
  identityAdminCache = createClient(identityUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return identityAdminCache;
}

async function readRows(
  admin: IdentityAdminClient,
  schema: string,
  table: string,
  limit: number,
): Promise<GenericRow[]> {
  const run = async (useScopedSchema: boolean) =>
    tableRef(admin, schema, table, useScopedSchema).select("*").limit(limit);

  let response = await run(true);
  if (response.error && isSchemaProfileError(response.error.message)) {
    response = await run(false);
  }
  if (response.error) {
    if (isMissingRelationError(response.error.message)) {
      return [];
    }
    throw new Error(`${table}: ${response.error.message}`);
  }

  if (!Array.isArray(response.data)) {
    return [];
  }
  return response.data as GenericRow[];
}

function mapRuntime(rows: GenericRow[], preferredRuntimeKey: string): IdentityRuntimeSharedRuntime | null {
  const sorted = sortByRecency(rows);
  if (!sorted.length) return null;
  const byPreferred = sorted.find((row) => normalizeString(row.runtime_key) === preferredRuntimeKey);
  const row =
    byPreferred ||
    sorted.find((candidate) => normalizeString(candidate.runtime_key) !== SUPERADMIN_RESTRICTIONS_RUNTIME_KEY) ||
    sorted[0];
  const metadata = asObject(row.metadata);
  const awareness = asObject(metadata.awareness_state);
  return {
    runtimeKey: normalizeString(row.runtime_key) || "default",
    state: normalizeString(row.runtime_state) || "unknown",
    enabled: normalizeBoolean(row.runtime_enabled, false),
    paused: normalizeBoolean(row.runtime_paused, false),
    selectedSourceId: normalizeString(row.selected_source_id) || null,
    awareness,
    updatedAt: normalizeString(row.updated_at) || null,
  };
}

function extractSuperadminRestrictions(rows: GenericRow[]): SuperadminRestrictions {
  const defaults: SuperadminRestrictions = {
    allowSharedIdentityMemory: null,
    maxPromptChars: null,
  };
  if (!rows.length) return defaults;
  const policyRow = sortByRecency(rows).find(
    (row) => normalizeString(row.runtime_key) === SUPERADMIN_RESTRICTIONS_RUNTIME_KEY,
  );
  if (!policyRow) return defaults;
  const metadata = asObject(policyRow.metadata);
  const superadminScope = asObject(metadata.superadmin);
  const restrictions = asObject(superadminScope.restrictions);
  const legacyRestrictions = asObject(metadata.restrictions);
  const allowRaw =
    restrictions.allow_shared_identity_memory ??
    restrictions.allowSharedIdentityMemory ??
    legacyRestrictions.allow_shared_identity_memory ??
    legacyRestrictions.allowSharedIdentityMemory;
  const maxPromptCharsRaw =
    restrictions.max_prompt_chars ??
    restrictions.maxPromptChars ??
    legacyRestrictions.max_prompt_chars ??
    legacyRestrictions.maxPromptChars;
  const allowSharedIdentityMemory =
    allowRaw === undefined || allowRaw === null ? null : normalizeBoolean(allowRaw, true);
  const maxPromptChars = Number.isFinite(Number(maxPromptCharsRaw))
    ? Math.max(600, Math.min(24_000, Math.round(Number(maxPromptCharsRaw))))
    : null;
  return {
    allowSharedIdentityMemory,
    maxPromptChars,
  };
}

function mapTrackedEntities(rows: GenericRow[], maxItems: number): IdentityRuntimeSharedEntity[] {
  return sortByRecency(rows)
    .slice(0, maxItems)
    .map((row) => ({
      entityKey: normalizeString(row.entity_key),
      label: normalizeString(row.display_label),
      mode: normalizeString(row.entity_mode),
      confidence: Math.max(0, Math.min(1, normalizeNumber(row.confidence, 0))),
      sourceKey: normalizeString(row.source_key) || null,
      nominalName: normalizeString(row.nominal_name) || null,
      lastSeenAt: normalizeString(row.last_seen_at) || null,
    }))
    .filter((item) => Boolean(item.entityKey));
}

function mapActiveTargets(rows: GenericRow[], maxItems: number): IdentityRuntimeSharedTarget[] {
  return sortByRecency(rows)
    .filter((row) => normalizeBoolean(row.search_active, false) && isActiveIdentityPerson(row))
    .slice(0, maxItems)
    .map((row) => ({
      personId: normalizeString(row.person_id),
      displayName: normalizeString(row.display_name),
      profileKind: normalizeString(row.profile_kind) || "wanted",
      searchActive: normalizeBoolean(row.search_active, false),
      preliminaryThreshold: Math.max(0, Math.min(1, normalizeNumber(row.preliminary_similarity_threshold, 0.72))),
      strongThreshold: Math.max(0, Math.min(1, normalizeNumber(row.strong_similarity_threshold, 0.82))),
      minConsecutiveHits: Math.max(1, Math.round(normalizeNumber(row.min_consecutive_hits, 3))),
      minWindowMs: Math.max(100, Math.round(normalizeNumber(row.min_window_ms, 2400))),
      updatedAt: normalizeString(row.updated_at) || null,
    }))
    .filter((item) => Boolean(item.personId));
}

function mapRecentMatches(rows: GenericRow[], maxItems: number): IdentityRuntimeSharedMatch[] {
  return sortByRecency(rows)
    .slice(0, maxItems)
    .map((row) => ({
      matchKey: normalizeString(row.match_key),
      candidateImageKey: normalizeString(row.candidate_image_key),
      entityKey: normalizeString(row.entity_key) || null,
      sourceKey: normalizeString(row.source_key) || null,
      status: normalizeString(row.match_status) || "review",
      similarity: Math.max(0, Math.min(1, normalizeNumber(row.similarity_score, 0))),
      threshold: Math.max(0, Math.min(1, normalizeNumber(row.positive_threshold, 0.72))),
      updatedAt: normalizeString(row.updated_at) || normalizeString(row.created_at) || null,
    }))
    .filter((item) => Boolean(item.matchKey || item.candidateImageKey));
}

function mapLayerSummary(rows: GenericRow[], maxItems: number): IdentityRuntimeSharedLayerSummary[] {
  const aggregates = new Map<
    string,
    { total: number; pass: number; review: number; fail: number; scoreSum: number; scoreCount: number }
  >();

  for (const row of rows) {
    const layerName = normalizeString(row.layer_name) || "layer_unknown";
    const layerResult = normalizeString(row.layer_result).toLowerCase();
    const score = normalizeNumber(row.layer_score, Number.NaN);
    const current = aggregates.get(layerName) || { total: 0, pass: 0, review: 0, fail: 0, scoreSum: 0, scoreCount: 0 };
    current.total += 1;
    if (layerResult === "pass") current.pass += 1;
    else if (layerResult === "fail") current.fail += 1;
    else current.review += 1;
    if (Number.isFinite(score)) {
      current.scoreSum += score;
      current.scoreCount += 1;
    }
    aggregates.set(layerName, current);
  }

  return Array.from(aggregates.entries())
    .map(([layerName, item]) => ({
      layerName,
      total: item.total,
      pass: item.pass,
      review: item.review,
      fail: item.fail,
      avgScore: item.scoreCount > 0 ? Number((item.scoreSum / item.scoreCount).toFixed(4)) : 0,
    }))
    .sort((left, right) => right.total - left.total)
    .slice(0, maxItems);
}

function buildCanonicalAssistantIdentityPromptBlock(maxChars: number) {
  if (!canonicalIdentityFallbackEnabled()) return "";
  const opening = [
    "[CANONICAL_ASSISTANT_IDENTITY]",
    "Use este bloco como base canonica quando a pergunta for sobre identidade/nome/significado da Letícia.",
  ].join("\n");
  const closing = "[/CANONICAL_ASSISTANT_IDENTITY]";
  const payload = JSON.stringify(CANONICAL_ASSISTANT_IDENTITY_PAYLOAD);
  const full = `${opening}\n${payload}\n${closing}`;
  if (full.length <= maxChars) return full;
  const bodyBudget = Math.max(220, maxChars - opening.length - closing.length - 40);
  const truncatedPayload = `${payload.slice(0, bodyBudget)}...[truncated]`;
  return `${opening}\n${truncatedPayload}\n${closing}`;
}

function buildPromptBlock(snapshot: IdentityRuntimeSharedSnapshot, maxChars: number, includeRuntime: boolean) {
  const canonicalBlock = buildCanonicalAssistantIdentityPromptBlock(
    Math.min(maxChars, DEFAULT_CANONICAL_IDENTITY_MAX_CHARS),
  );
  if (!includeRuntime) return canonicalBlock;
  const compactPayload = {
    generated_at: snapshot.generatedAt,
    runtime: snapshot.runtime,
    tracked_entities: snapshot.trackedEntities,
    active_targets: snapshot.activeTargets,
    recent_matches: snapshot.recentMatches,
    layer_summary: snapshot.layerSummary,
    counts: snapshot.counts,
  };
  const runtimeOpening = [
    "[IDENTITY_RUNTIME_SHARED_MEMORY]",
    "Use este estado SQL como memoria operacional oficial de reconhecimento facial.",
    "Base para perguntas/comandos de identificacao, busca e acompanhamento de pessoas.",
  ].join("\n");
  const runtimeClosing = "[/IDENTITY_RUNTIME_SHARED_MEMORY]";
  const payload = JSON.stringify(compactPayload);
  const runtimeBlock = `${runtimeOpening}\n${payload}\n${runtimeClosing}`;

  const joiner = canonicalBlock ? "\n\n" : "";
  const full = `${canonicalBlock}${joiner}${runtimeBlock}`;
  if (full.length <= maxChars) return full;
  const runtimeBudget = Math.max(256, maxChars - canonicalBlock.length - joiner.length);
  const bodyBudget = Math.max(128, runtimeBudget - runtimeOpening.length - runtimeClosing.length - 40);
  const truncatedPayload = `${payload.slice(0, bodyBudget)}...[truncated]`;
  const runtimeTruncated = `${runtimeOpening}\n${truncatedPayload}\n${runtimeClosing}`;
  return `${canonicalBlock}${joiner}${runtimeTruncated}`;
}

function buildContextDisabled(reason: string, maxPromptChars = DEFAULT_MAX_PROMPT_CHARS): IdentityRuntimeSharedContext {
  return {
    enabled: false,
    status: "disabled",
    reason,
    snapshot: null,
    promptBlock: buildCanonicalAssistantIdentityPromptBlock(maxPromptChars),
    loadedAt: new Date().toISOString(),
  };
}

export async function resolveIdentityRuntimeSharedContext(input?: {
  forceRefresh?: boolean;
}): Promise<IdentityRuntimeSharedContext> {
  const maxPromptChars = parseBoundedInt(
    process.env.IDENTITY_SHARED_MEMORY_MAX_PROMPT_CHARS,
    DEFAULT_MAX_PROMPT_CHARS,
    600,
    24_000,
  );
  if (!identitySharedMemoryEnabled()) {
    return buildContextDisabled("identity_shared_memory_disabled", maxPromptChars);
  }

  const cacheMs = parseBoundedInt(process.env.IDENTITY_SHARED_MEMORY_CACHE_MS, DEFAULT_CACHE_MS, 250, 120_000);
  const now = Date.now();
  if (!input?.forceRefresh && runtimeContextCache && runtimeContextCache.expiresAt > now) {
    return runtimeContextCache.value;
  }

  const admin = getIdentityAdminClient();
  if (!admin) {
    return buildContextDisabled("identity_supabase_not_configured", maxPromptChars);
  }

  const schema = pickFirstNonEmpty(process.env.AI_SYSTEM_ANM_IDENTITY_SQL_SCHEMA, DEFAULT_SCHEMA);
  const maxEntities = parseBoundedInt(process.env.IDENTITY_SHARED_MEMORY_MAX_ENTITIES, DEFAULT_MAX_ENTITIES, 1, 20);
  const maxMatches = parseBoundedInt(process.env.IDENTITY_SHARED_MEMORY_MAX_MATCHES, DEFAULT_MAX_MATCHES, 1, 24);
  const maxTargets = parseBoundedInt(process.env.IDENTITY_SHARED_MEMORY_MAX_TARGETS, DEFAULT_MAX_TARGETS, 1, 20);
  const maxLayerSummary = parseBoundedInt(
    process.env.IDENTITY_SHARED_MEMORY_MAX_LAYER_SUMMARY,
    DEFAULT_MAX_LAYER_SUMMARY,
    1,
    30,
  );
  const preferredRuntimeKey = pickFirstNonEmpty(process.env.AI_SYSTEM_ANM_IDENTITY_RUNTIME_KEY, "default");

  try {
    const [runtimeRows, entityRows, matchRows, layerRows, targetRows] = await Promise.all([
      readRows(admin, schema, "identity_runtime_config", 8),
      readRows(admin, schema, "identity_entities", 32),
      readRows(admin, schema, "identity_embedding_matches", 40),
      readRows(admin, schema, "identity_interpretation_layers", 120),
      readRows(admin, schema, "identity_persons", 40),
    ]);
    const superadminRestrictions = extractSuperadminRestrictions(runtimeRows);
    if (superadminRestrictions.allowSharedIdentityMemory === false) {
      const value = buildContextDisabled("superadmin_shared_identity_memory_disabled", maxPromptChars);
      runtimeContextCache = {
        expiresAt: now + cacheMs,
        value,
      };
      return value;
    }
    const effectiveMaxPromptChars = superadminRestrictions.maxPromptChars ?? maxPromptChars;

    const snapshot: IdentityRuntimeSharedSnapshot = {
      generatedAt: new Date().toISOString(),
      runtime: mapRuntime(runtimeRows, preferredRuntimeKey),
      trackedEntities: mapTrackedEntities(entityRows, maxEntities),
      activeTargets: mapActiveTargets(targetRows, maxTargets),
      recentMatches: mapRecentMatches(matchRows, maxMatches),
      layerSummary: mapLayerSummary(layerRows, maxLayerSummary),
      counts: {
        trackedEntities: entityRows.length,
        activeTargets: targetRows.filter((row) => normalizeBoolean(row.search_active, false)).length,
        recentMatches: matchRows.length,
        layerRows: layerRows.length,
      },
    };

    const hasAnySignal =
      Boolean(snapshot.runtime) ||
      snapshot.trackedEntities.length > 0 ||
      snapshot.recentMatches.length > 0 ||
      snapshot.activeTargets.length > 0 ||
      snapshot.layerSummary.length > 0;

    const value: IdentityRuntimeSharedContext = {
      enabled: true,
      status: hasAnySignal ? "ready" : "degraded",
      reason: hasAnySignal ? null : "identity_shared_memory_empty",
      snapshot,
      promptBlock: buildPromptBlock(snapshot, effectiveMaxPromptChars, hasAnySignal),
      loadedAt: new Date().toISOString(),
    };

    runtimeContextCache = {
      expiresAt: now + cacheMs,
      value,
    };
    return value;
  } catch (error) {
    const message = error instanceof Error ? error.message : "identity_shared_memory_failed";
    logger.warn("IDENTITY_SHARED_MEMORY_LOAD_FAILED", { message, schema });
    const value: IdentityRuntimeSharedContext = {
      enabled: true,
      status: "degraded",
      reason: message,
      snapshot: null,
      promptBlock: buildCanonicalAssistantIdentityPromptBlock(maxPromptChars),
      loadedAt: new Date().toISOString(),
    };
    runtimeContextCache = {
      expiresAt: now + cacheMs,
      value,
    };
    return value;
  }
}

export function injectIdentityRuntimePrompt(prompt: string, promptBlock: string) {
  const message = normalizeString(prompt);
  if (!message) return "";
  const normalizedBlock = normalizeString(promptBlock);
  if (!normalizedBlock) return message;
  return `${normalizedBlock}\n\n[USER_PROMPT]\n${message}\n[/USER_PROMPT]`;
}

