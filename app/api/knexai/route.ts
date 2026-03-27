import { NextRequest } from "next/server";
import { execFileSync } from "node:child_process";
import { createAssistantPipelineOrchestratorService } from "@/core/assistant/pipeline/pipeline-orchestrator.service";
import { LETICIA_SYSTEM_PROMPT } from "@/lib/knexai/spec";
import { loadPathConfig } from "@/core/config/paths";
import { resolveIdentityRuntimeSharedContext } from "@/core/identity/shared-memory-context";
import { createRagQueryService } from "@/core/rag/rag-query-service";
import { createRagInternetSearchService, type InternetSearchResponse } from "@/core/rag/internet-search-service";
import { RagPipelineError } from "@/core/rag/rag-errors";
import { toSseStream } from "@/core/rag/streaming-response";
import { readConfiguredAnmBaseUrl, resolveReachableAnmBaseUrl } from "@/app/api/_shared/anm-endpoint";
import { runPipelineRootBridge } from "../../../ai-system-anm-rag-qis/src/00-myelinated-pipeline-core/pipeline-root-bridge";
import { resolveIdentityFallbackForMessage } from "../../../ai-system-anm-rag-qis/src/17b-response-behavior-layer/ai-identity-regulator";
import {
  buildConversationStateSummaryBlock,
  injectConversationStatePrompt,
  rebuildConversationState,
} from "@/core/chat/perception/conversation-state.manager";
import { enforceResponseStructure } from "@/core/chat/perception/response-structure.enforcer";
import type { ConversationPerceptionState } from "@/core/chat/perception/types";

export const runtime = "nodejs";

const ragService = createRagQueryService();
const internetSearchService = createRagInternetSearchService();
const assistantOrchestrator = createAssistantPipelineOrchestratorService(ragService);


type ChatRole = "user" | "assistant";
type ChatHistoryItem = { role: ChatRole; content: string };
type ModelChatRole = "system" | "user" | "assistant";
type ModelChatMessage = { role: ModelChatRole; content: string };
type PromptComplexity = "micro" | "direct" | "short" | "medium" | "complex";
type SupportedLocale = "en-US" | "es-ES" | "pt-BR";
type GenerationProfile = {
  temperature: number;
  topP: number;
  maxTokens: number;
  repetitionPenalty: number;
  brevityInstruction: string;
};
type LlmConfig = {
  baseUrl: string;
  fallbackBaseUrls: string[];
  model: string;
  modelFallbacks: string[];
  apiKey: string;
  timeoutMs: number;
  contextWindow: number;
  maxTokens: number;
  hostOnly: boolean;
};
type EngineMode = "direct" | "anm";
type EngineModeConfig = {
  mode: EngineMode;
  anmBaseUrl: string;
  anmTimeoutMs: number;
  anmSoftTimeoutMs: number;
  fallbackToDirect: boolean;
};
type AnmChatResult = {
  answer: string;
  traceId: string | null;
};
type ResponsePolicyContext = {
  state: ConversationPerceptionState;
  complexity: PromptComplexity;
};
type AutoWebEvidence = {
  contextBlock: string;
  queryCount: number;
  resultCount: number;
  sources: string[];
  domainCount: number;
  officeCandidates: string[];
};
type VerificationCascadePlan = {
  version: string;
  targetPrompt: string;
  verifiableQuestion: boolean;
  forceWebMultiSource: boolean;
  forceRag: boolean;
  shouldForceFullRagMode: boolean;
  shouldRequireWebBeforeRag: boolean;
  forceUserOnlyHistory: boolean;
  forceDirectWithoutDocumentScope: boolean;
};
type EngineAttempt<T> = {
  source: "anm" | "direct";
  ok: true;
  value: T;
} | {
  source: "anm" | "direct";
  ok: false;
  error: unknown;
};
type EngineHealthProbeResult = {
  ok: boolean;
  status: number;
  detail: string;
  checkedAt: number;
  baseUrl?: string;
  attemptedBaseUrls?: string[];
};
type DescendingPipelineConfig = {
  enabled: boolean;
  onlyVerifiable: boolean;
  strict: boolean;
  allowVerifiable: boolean;
};
type AssistantIdentityIntentFamily = "identity" | "name_semantics" | "creator_identity" | null;

const DEFAULT_BASE_URL = "http://127.0.0.1:8000/v1";
const DEFAULT_MODEL = "mistral-awq";
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_TOKENS = 8_192;
const DEFAULT_CONTEXT_WINDOW = 8_192;
const CONTEXT_RESERVE_TOKENS = 256;
const AVAILABLE_MODELS_CACHE_TTL_MS = 30_000;
const ENGINE_HEALTH_CACHE_TTL_MS = Math.max(500, Number(process.env.KNEXAI_ENGINE_HEALTH_CACHE_TTL_MS || 3_000));
const ENGINE_HEALTH_TIMEOUT_MS = Math.max(200, Number(process.env.KNEXAI_ENGINE_HEALTH_TIMEOUT_MS || 1_500));
const WSL_DISCOVERY_CACHE_MS = 60_000;
const DEFAULT_ANM_BASE_URL = "http://127.0.0.1:3000";
const DEFAULT_ANM_TIMEOUT_MS = 45_000;
const DEFAULT_ANM_SOFT_TIMEOUT_MS = 200;
const VERIFICATION_CASCADE_VERSION = "2026-03-12.1";

type AvailableModelsCache = {
  baseUrl: string;
  apiKey: string;
  expiresAt: number;
  models: string[];
};

let availableModelsCache: AvailableModelsCache | null = null;
let anmHealthProbeCache: { key: string; expiresAt: number; result: EngineHealthProbeResult } | null = null;
let llmHealthProbeCache: { key: string; expiresAt: number; result: EngineHealthProbeResult } | null = null;
let wslDiscoveryCache: { key: string; checkedAt: number; urls: string[] } | null = null;

function pickFirstNonEmpty(...values: Array<string | undefined | null>) {
  for (const value of values) {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (trimmed) return trimmed;
  }
  return "";
}

function normalizeUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function parseBooleanFlag(value: string | undefined, fallback: boolean) {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parseOptionalBoolean(value: string | undefined | null): boolean | undefined {
  const normalized = `${value || ""}`.trim().toLowerCase();
  if (!normalized) return undefined;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return undefined;
}

function readDescendingPipelineConfig(): DescendingPipelineConfig {
  return {
    enabled: parseOptionalBoolean(process.env.KNEXAI_DESCENDING_PIPELINE_ENABLED) !== false,
    onlyVerifiable: parseOptionalBoolean(process.env.KNEXAI_DESCENDING_PIPELINE_ONLY_VERIFIABLE) !== false,
    strict: parseOptionalBoolean(process.env.KNEXAI_DESCENDING_PIPELINE_STRICT) !== false,
    allowVerifiable: parseOptionalBoolean(process.env.KNEXAI_DESCENDING_PIPELINE_ALLOW_VERIFIABLE) !== false,
  };
}

function parseBaseUrlList(value: string) {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const token of value.split(/[,\n;]+/g)) {
    const normalized = normalizeUrl(token.trim());
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function enforceLoopbackBaseUrl(baseUrl: string) {
  try {
    const parsed = new URL(baseUrl);
    const hostname = `${parsed.hostname || ""}`.trim().toLowerCase();
    if (hostname === "localhost") {
      parsed.hostname = "127.0.0.1";
    }
    return normalizeUrl(parsed.toString());
  } catch {
    return normalizeUrl(baseUrl);
  }
}

function isLoopbackHostname(hostname: string) {
  const normalized = (hostname || "").trim().toLowerCase();
  return normalized === "127.0.0.1" || normalized === "localhost";
}

function isIpv4Address(value: string) {
  const parts = value.trim().split(".");
  if (parts.length !== 4) return false;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return false;
    const parsed = Number(part);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 255) return false;
  }
  return true;
}

function replaceHostname(baseUrl: string, host: string) {
  try {
    const parsed = new URL(baseUrl);
    parsed.hostname = host;
    return normalizeUrl(parsed.toString());
  } catch {
    return "";
  }
}

function tryDiscoverWslHostIp() {
  try {
    const output = execFileSync(
      "wsl.exe",
      ["-e", "bash", "-lc", "hostname -I 2>/dev/null | awk '{print $1}'"],
      {
        encoding: "utf8",
        timeout: 1200,
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    return `${output || ""}`.trim();
  } catch {
    return "";
  }
}

function normalizeTemporalPrompt(prompt: string) {
  return prompt
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[!?.,;:"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isCurrentDatePrompt(prompt: string) {
  const normalized = normalizeTemporalPrompt(prompt);
  if (!normalized) return false;
  const patterns = [
    /\b(qual|que)\s+(e|eh)\s+(o\s+)?(dia|data)\s+de\s+hoje\b/,
    /\bqual\s+(o\s+)?(dia|data)\s+de\s+hoje\b/,
    /\bme\s+diga\s+(o\s+)?(dia|data)\s+de\s+hoje\b/,
    /\bque\s+dia\s+(e|eh)\s+hoje\b/,
    /\bhoje\s+(e|eh)\s+que\s+dia\b/,
    /\bwhat\s+day\s+is\s+it\s+today\b/,
    /\bwhat\s+is\s+todays?\s+date\b/,
    /\btodays?\s+date\b/,
  ];
  return patterns.some((pattern) => pattern.test(normalized));
}

function buildCurrentDateContext() {
  const now = new Date();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const locale = "pt-BR";
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone }).format(now);
  const date = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "long", year: "numeric", timeZone }).format(now);
  return {
    weekday,
    date,
    timeZone,
    line: `Data atual de referencia: ${weekday}, ${date} (fuso ${timeZone}).`,
  };
}

function buildCurrentDateAnswer() {
  const current = buildCurrentDateContext();
  return `Hoje e ${current.weekday}, ${current.date}. (Fuso: ${current.timeZone})`;
}

function buildWebVerificationUnavailableAnswer(localeHint: string) {
  const normalized = `${localeHint || ""}`.trim().toLowerCase();
  if (normalized.startsWith("en")) {
    return "I could not validate this fact with web sources in this turn. To avoid outdated information, I need to rerun multi-source verification before confirming it.";
  }
  if (normalized.startsWith("es")) {
    return "No pude validar este dato con fuentes web en este turno. Para evitar información desactualizada, necesito repetir la verificación multifuente antes de confirmarlo.";
  }
  return "Não consegui validar esse fato em fontes web neste turno. Para evitar informação desatualizada, preciso repetir a verificação multifonte antes de confirmar.";
}

function buildReferenceGroundingRequiredAnswer(localeHint: string) {
  const normalized = `${localeHint || ""}`.trim().toLowerCase();
  if (normalized.startsWith("en")) {
    return "I cannot safely write \"according to Author (Year)\" without a concrete source. Please send the reference (title, link, DOI, or excerpt) so I can ground the answer.";
  }
  if (normalized.startsWith("es")) {
    return "No puedo redactar \"según Autor (Año)\" sin una fuente concreta. Envía la referencia (título, enlace, DOI o extracto) para fundamentar la respuesta.";
  }
  return "Não posso redigir \"segundo Autor (Ano)\" sem uma fonte concreta. Envie a referência (título, link, DOI ou trecho) para eu fundamentar a resposta.";
}

function buildWebVerificationResponsePolicy(localeHint: string) {
  const normalized = `${localeHint || ""}`.trim().toLowerCase();
  if (normalized.startsWith("en")) {
    return [
      "[WEB_VERIFIED_POLICY]",
      "Answer only with facts supported by WEB_VERIFIED_CONTEXT.",
      "Use natural language and avoid template-like labels.",
      "Start with one direct sentence answering the question.",
      "At the end, include 'Sources:' with at least 2 distinct URLs used.",
      "If sources conflict, explicitly state uncertainty.",
      "Do not infer unstated historical facts (e.g., predecessors) unless explicitly present in sources.",
      "[/WEB_VERIFIED_POLICY]",
    ].join("\n");
  }
  if (normalized.startsWith("es")) {
    return [
      "[WEB_VERIFIED_POLICY]",
      "Responde solo con hechos respaldados por WEB_VERIFIED_CONTEXT.",
      "Usa lenguaje natural y evita etiquetas de plantilla.",
      "Comienza con una frase directa que responda a la pregunta.",
      "Al final, incluye 'Fuentes:' con al menos 2 URL distintas utilizadas.",
      "Si hay conflicto entre fuentes, declara la incertidumbre de forma explicita.",
      "No infieras hechos historicos no citados (por ejemplo, predecesores) sin fuente explicita.",
      "[/WEB_VERIFIED_POLICY]",
    ].join("\n");
  }
  return [
    "[WEB_VERIFIED_POLICY]",
    "Responda apenas com fatos sustentados pelo bloco WEB_VERIFIED_CONTEXT.",
    "Use linguagem natural e evite rotulos de template.",
    "Comece com 1 frase objetiva respondendo diretamente a pergunta.",
    "Ao final, inclua 'Fontes:' com pelo menos 2 URLs distintas usadas.",
    "Se houver conflito entre as fontes, declare a incerteza explicitamente.",
    "Nao infira fatos historicos nao citados (ex.: antecessores) sem fonte explicita.",
    "[/WEB_VERIFIED_POLICY]",
  ].join("\n");
}

function buildDeterministicOfficeAnswer(localeHint: string, candidate: string, sources: string[]) {
  const normalized = `${localeHint || ""}`.trim().toLowerCase();
  const sourceList = sources.slice(0, 2).filter(Boolean);
  const sourceSuffix =
    sourceList.length > 0
      ? normalized.startsWith("en")
        ? ` Sources: ${sourceList.join(" | ")}`
        : normalized.startsWith("es")
          ? ` Fuentes: ${sourceList.join(" | ")}`
          : ` Fontes: ${sourceList.join(" | ")}`
      : "";
  if (normalized.startsWith("en")) {
    return `Current office holder: ${candidate}.${sourceSuffix}`;
  }
  if (normalized.startsWith("es")) {
    return `Titular actual: ${candidate}.${sourceSuffix}`;
  }
  return `Titular atual verificado: ${candidate}.${sourceSuffix}`;
}

function normalizeForVerification(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

const BRAZIL_STATE_ALIASES = new Map<string, string>([
  ["acre", "acre"],
  ["alagoas", "alagoas"],
  ["amapa", "amapa"],
  ["amazonas", "amazonas"],
  ["bahia", "bahia"],
  ["ceara", "ceara"],
  ["distrito federal", "distrito federal"],
  ["espirito santo", "espirito santo"],
  ["goias", "goias"],
  ["maranhao", "maranhao"],
  ["mato grosso", "mato grosso"],
  ["mato grosso do sul", "mato grosso do sul"],
  ["minas gerais", "minas gerais"],
  ["para", "para"],
  ["paraiba", "paraiba"],
  ["parana", "parana"],
  ["pernambuco", "pernambuco"],
  ["piaui", "piaui"],
  ["rio de janeiro", "rio de janeiro"],
  ["rio grande do norte", "rio grande do norte"],
  ["rio grande do sul", "rio grande do sul"],
  ["rondonia", "rondonia"],
  ["roraima", "roraima"],
  ["santa catarina", "santa catarina"],
  ["sao paulo", "sao paulo"],
  ["sergipe", "sergipe"],
  ["tocantins", "tocantins"],
]);

const LOCATION_STATE_HINTS = new Map<string, string>([
  ["rio branco", "acre"],
  ["cruzeiro do sul", "acre"],
]);

const GEO_QUERY_STOPWORDS = new Set([
  "a",
  "o",
  "as",
  "os",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "esse",
  "essa",
  "este",
  "esta",
  "qual",
  "que",
  "estado",
  "fica",
  "cidade",
  "municipio",
  "municipio",
]);

function resolveExplicitBrazilState(value: string) {
  const normalized = normalizeForVerification(value);
  if (!normalized) return "";
  for (const [alias, canonical] of BRAZIL_STATE_ALIASES.entries()) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`);
    if (pattern.test(normalized)) return canonical;
  }
  return "";
}

function extractGeographicPlaceCandidate(prompt: string) {
  const normalized = normalizeForVerification(prompt);
  if (!normalized) return "";

  const officeMatch = normalized.match(
    /\b(?:prefeito|governador|presidente|ministro|reitor)\s+(?:de|do|da)\s+(.+)$/i,
  );
  if (officeMatch?.[1]) {
    return officeMatch[1]
      .replace(/\b(?:no|na|estado|cidade|municipio)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 96);
  }

  const stateQuestionPatterns = [
    /\b(?:esse|essa|este|esta|o|a)?\s*([a-z][a-z\s-]{2,})\s+(?:e|eh)\s+de\s+qual\s+estado\b/i,
    /\bem\s+que\s+estado\s+fica\s+([a-z][a-z\s-]{2,})\b/i,
    /\b([a-z][a-z\s-]{2,})\s+fica\s+em\s+qual\s+estado\b/i,
  ];
  for (const pattern of stateQuestionPatterns) {
    const match = normalized.match(pattern);
    const candidate = `${match?.[1] || ""}`
      .replace(/\b(?:no|na|estado|cidade|municipio)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (candidate.length >= 3) return candidate.slice(0, 96);
  }
  return "";
}

function resolveHistoryStateHint(history: ChatHistoryItem[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const item = history[index];
    if (!item || item.role !== "user") continue;
    const explicit = resolveExplicitBrazilState(item.content || "");
    if (explicit) return explicit;
    const normalized = normalizeForVerification(item.content || "");
    if (!normalized) continue;
    for (const [location, state] of LOCATION_STATE_HINTS.entries()) {
      if (normalized.includes(location)) return state;
    }
  }
  return "";
}

function isGeographicStateQuestion(prompt: string) {
  const normalized = normalizeForVerification(prompt);
  if (!normalized) return false;
  const asksState =
    /\b(?:qual|que|em que)\s+estado\b/.test(normalized) ||
    /\bde\s+qual\s+estado\b/.test(normalized);
  if (!asksState) return false;
  const place = extractGeographicPlaceCandidate(normalized);
  if (place) return true;
  const meaningfulTokens = normalized
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !GEO_QUERY_STOPWORDS.has(token));
  return meaningfulTokens.length >= 2;
}

function enrichVerificationTargetPrompt(prompt: string, history: ChatHistoryItem[]) {
  const base = `${prompt || ""}`.trim();
  if (!base) return "";
  if (resolveExplicitBrazilState(base)) return base;
  if (!isOfficeContextPrompt(base) && !isGeographicStateQuestion(base)) return base;

  const stateHint = resolveHistoryStateHint(history);
  if (!stateHint) return base;
  const normalizedBase = normalizeForVerification(base);
  if (normalizedBase.includes(stateHint)) return base;

  if (isGeographicStateQuestion(base)) {
    const place = extractGeographicPlaceCandidate(base);
    if (place) {
      return `${place} em qual estado no contexto de ${stateHint} no brasil`;
    }
    return `${base} (contexto da conversa: ${stateHint})`;
  }

  return `${base} no estado do ${stateHint}`;
}

function isOfficeContextPrompt(prompt: string) {
  const normalized = normalizeForVerification(prompt);
  if (!normalized) return false;
  return /\b(reitor|reitora|presidente|prefeito|governador|ministro|secretario|diretor|ceo|rector|chancellor)\b/.test(
    normalized,
  );
}

function isCurrentOfficeQuestion(prompt: string) {
  const normalized = normalizeForVerification(prompt);
  if (!normalized) return false;
  return isOfficeContextPrompt(normalized) && /\b(quem|who|qual|nome|current|atual|hoje|agora)\b/.test(normalized);
}

function isOfficeDetailPrompt(prompt: string) {
  const normalized = normalizeForVerification(prompt);
  if (!normalized) return false;
  if (!isOfficeContextPrompt(normalized)) return false;
  return /\b(fale|conte|detalhe|sobre|mais|historico|historia|mandato|eleito|reeleito|informacao|informacoes)\b/.test(
    normalized,
  );
}

function isUsOfficeQuestion(prompt: string) {
  const normalized = normalizeForVerification(prompt);
  if (!normalized) return false;
  return /\b(estados unidos|eua|usa|united states|u\.s\.)\b/.test(normalized);
}

function isBrazilOfficeQuestion(prompt: string) {
  const normalized = normalizeForVerification(prompt);
  if (!normalized) return false;
  return /\b(brasil|brazil|acre|sao paulo|rio de janeiro|minas gerais|bahia|parana|goias|amazonas|estado)\b/.test(
    normalized,
  );
}

function isAuthorYearReferencePrompt(prompt: string) {
  const normalized = normalizeForVerification(prompt);
  if (!normalized) return false;
  const hasAuthorFrame = /\b(segundo|conforme|de acordo com|autor|autora)\b/.test(normalized);
  const hasYear = /\b(19|20)\d{2}\b/.test(normalized);
  return hasAuthorFrame && hasYear;
}

function isVerifiableQuestionForAutoSearch(prompt: string) {
  const normalized = normalizeForVerification(prompt);
  if (!normalized) return false;
  const asksCurrentOffice = isCurrentOfficeQuestion(normalized);
  const asksOfficeDetails = isOfficeDetailPrompt(normalized);
  const asksGeographicState = isGeographicStateQuestion(normalized);
  const asksAuthorYearReference = isAuthorYearReferencePrompt(normalized);
  const asksVerifiableData =
    /\b(data|ano|numero|percentual|taxa|fonte|citacao|referencia|lei|norma|resolucao|preco|valor|dosagem|dose|mg|ml)\b/.test(
      normalized,
    );
  return asksCurrentOffice || asksOfficeDetails || asksGeographicState || asksAuthorYearReference || asksVerifiableData;
}

function isTrustedOfficeDomain(hostname: string) {
  const host = `${hostname || ""}`.trim().toLowerCase();
  if (!host) return false;
  if (host.endsWith(".gov")) return true;
  if (host.endsWith(".gov.br")) return true;
  if (host.endsWith(".jus.br")) return true;
  if (host.endsWith(".leg.br")) return true;
  return (
    host.includes("whitehouse.gov") ||
    host.includes("usa.gov") ||
    host.includes("wikipedia.org") ||
    host.includes("reuters.com") ||
    host.includes("apnews.com") ||
    host.includes("bbc.") ||
    host.includes("state.gov") ||
    host.includes("agenciabrasil.ebc.com.br") ||
    host.includes("g1.globo.com") ||
    host.includes("uol.com.br") ||
    host.includes("estadao.com.br") ||
    host.includes("cnnbrasil.com.br")
  );
}

function isOfficialGovernmentDomain(hostname: string) {
  const host = `${hostname || ""}`.trim().toLowerCase();
  if (!host) return false;
  if (host.endsWith(".gov")) return true;
  if (host.endsWith(".gov.br")) return true;
  if (host.endsWith(".jus.br")) return true;
  if (host.endsWith(".leg.br")) return true;
  return (
    host.includes("planalto.gov.br") ||
    host.includes("presidencia.gov.br") ||
    host.includes("camara.leg.br") ||
    host.includes("senado.leg.br")
  );
}

function isPrimaryAuthorityOfficeDomain(hostname: string) {
  const host = `${hostname || ""}`.trim().toLowerCase();
  if (!host) return false;
  if (host.endsWith(".gov")) return true;
  if (host.endsWith(".gov.br")) return true;
  if (host.includes("whitehouse.gov")) return true;
  if (host.includes("usa.gov")) return true;
  if (host.includes("planalto.gov.br")) return true;
  if (host.includes("presidencia.gov.br")) return true;
  return false;
}

function hasOfficeRoleSignal(
  row: InternetSearchResponse["results"][number],
  officeRole: string,
) {
  const normalized = normalizeForVerification(`${row.title || ""} ${row.snippet || ""} ${row.url || ""}`);
  if (!normalized) return false;
  if (!officeRole) {
    return /\b(prefeito|governador|presidente|ministro|reitor|mayor|governor|president|minister|rector)\b/.test(normalized);
  }
  const escapedRole = officeRole.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rolePattern = new RegExp(`\\b${escapedRole}\\b`);
  return rolePattern.test(normalized);
}

function scoreOfficeSourceRow(
  row: InternetSearchResponse["results"][number],
  officeRole: string,
  currentOfficeQuestion: boolean,
) {
  const host = extractHostname(row.url);
  const normalized = normalizeForVerification(`${row.title || ""} ${row.snippet || ""}`);
  let score = 0;
  if (isPrimaryAuthorityOfficeDomain(host)) score += 7;
  else if (isOfficialGovernmentDomain(host)) score += 5;
  else if (isTrustedOfficeDomain(host)) score += 2;
  if (hasOfficeRoleSignal(row, officeRole)) score += 2;
  if (currentOfficeQuestion && /\b(atual|incumbente|incumbent|titular|em exercicio|current)\b/.test(normalized)) score += 2;
  if (host.includes("wikipedia.org")) score -= 1;
  if (isLowSignalDomain(host)) score -= 2;
  return score;
}

function isVerificationFollowUpPrompt(prompt: string) {
  const normalized = normalizeForVerification(prompt);
  if (!normalized) return false;
  const conciseFollowUp = normalized.length <= 160;
  const asksVerification = /\b(verifique|verificar|confirme|confirmar|cheque|checar|validar|validacao|confirm|verify|check)\b/.test(
    normalized,
  );
  const asksDeepSearch = /\b(busca profunda|pesquise|pesquisar|pesquisa|internet|web|aprofunde)\b/.test(normalized);
  const asksForSources = /\b(fonte|fontes|source|sources|evidencia|evidence)\b/.test(normalized);
  return conciseFollowUp && (asksVerification || asksForSources || asksDeepSearch);
}

function resolveVerificationTargetPrompt(prompt: string, history: ChatHistoryItem[]) {
  const current = `${prompt || ""}`.trim();
  if (!current) return "";
  let target = current;
  if (!isVerifiableQuestionForAutoSearch(current) && isVerificationFollowUpPrompt(current)) {
    for (let index = history.length - 1; index >= 0; index -= 1) {
      const item = history[index];
      if (item.role !== "user") continue;
      const candidate = `${item.content || ""}`.trim();
      if (!candidate) continue;
      if (candidate === current) continue;
      if (isVerifiableQuestionForAutoSearch(candidate)) {
        target = candidate;
        break;
      }
    }
  }
  return enrichVerificationTargetPrompt(target, history);
}

function resolveVerificationCascadePlan(input: {
  prompt: string;
  hasDocumentScope: boolean;
  requestedForceRag: boolean;
  forceWebMultiSource: boolean;
  forceRagForVerifiable: boolean;
  forceDirectForVerifiable: boolean;
}) {
  const verifiableQuestion = isVerifiableQuestionForAutoSearch(input.prompt);
  const forceRag = input.requestedForceRag || input.hasDocumentScope || (input.forceRagForVerifiable && verifiableQuestion);
  const shouldForceFullRagMode = input.forceWebMultiSource && (verifiableQuestion || input.requestedForceRag);
  const shouldRequireWebBeforeRag = shouldForceFullRagMode && !input.hasDocumentScope;
  const forceUserOnlyHistory = input.forceWebMultiSource && verifiableQuestion;
  const forceDirectWithoutDocumentScope =
    input.forceDirectForVerifiable && input.forceWebMultiSource && verifiableQuestion && !input.hasDocumentScope;
  return {
    version: VERIFICATION_CASCADE_VERSION,
    targetPrompt: input.prompt,
    verifiableQuestion,
    forceWebMultiSource: input.forceWebMultiSource,
    forceRag,
    shouldForceFullRagMode,
    shouldRequireWebBeforeRag,
    forceUserOnlyHistory,
    forceDirectWithoutDocumentScope,
  } satisfies VerificationCascadePlan;
}

function logVerificationCascadeStage(stage: string, plan: VerificationCascadePlan, extra?: Record<string, unknown>) {
  console.info("KNEXAI_VERIFICATION_CASCADE", {
    stage,
    version: plan.version,
    prompt: plan.targetPrompt,
    verifiableQuestion: plan.verifiableQuestion,
    forceWebMultiSource: plan.forceWebMultiSource,
    forceRag: plan.forceRag,
    shouldForceFullRagMode: plan.shouldForceFullRagMode,
    shouldRequireWebBeforeRag: plan.shouldRequireWebBeforeRag,
    forceUserOnlyHistory: plan.forceUserOnlyHistory,
    forceDirectWithoutDocumentScope: plan.forceDirectWithoutDocumentScope,
    ...(extra || {}),
  });
}

function extractHostname(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname || ""}`.trim().toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function decodeSearchRedirectTarget(value: string) {
  const raw = `${value || ""}`.trim();
  if (!raw) return "";
  const decoded = decodeURIComponent(raw);
  if (/^https?:\/\//i.test(decoded)) return decoded;
  if (/^a1/i.test(decoded) && decoded.length > 3) {
    try {
      const maybe = Buffer.from(decoded.slice(2), "base64").toString("utf8").trim();
      if (/^https?:\/\//i.test(maybe)) return maybe;
    } catch {
      return "";
    }
  }
  return "";
}

function unwrapSearchRedirectUrl(url: string) {
  const raw = `${url || ""}`.trim();
  if (!raw) return "";
  try {
    const sanitized = raw.replace(/&amp;/gi, "&");
    const parsed = new URL(sanitized);
    const host = `${parsed.hostname || ""}`.toLowerCase();
    const path = `${parsed.pathname || ""}`.toLowerCase();
    if (host.includes("bing.com") && path.startsWith("/ck")) {
      const target = decodeSearchRedirectTarget(parsed.searchParams.get("u") || parsed.searchParams.get("url") || "");
      return target || sanitized;
    }
    if (host.includes("google.") && path === "/url") {
      const target = decodeSearchRedirectTarget(parsed.searchParams.get("q") || parsed.searchParams.get("url") || "");
      return target || sanitized;
    }
    if (host.includes("duckduckgo.com")) {
      const target = decodeSearchRedirectTarget(parsed.searchParams.get("uddg") || "");
      return target || sanitized;
    }
    return sanitized;
  } catch {
    return raw;
  }
}

function normalizeSearchResultRow(row: InternetSearchResponse["results"][number]) {
  const normalizedUrl = unwrapSearchRedirectUrl(`${row.url || ""}`.trim());
  return {
    ...row,
    url: normalizedUrl || `${row.url || ""}`.trim(),
  };
}

function isLowSignalDomain(hostname: string) {
  const host = `${hostname || ""}`.trim().toLowerCase();
  if (!host) return false;
  return (
    host.includes("dicio.com.br") ||
    host.includes("sinonimos.com.br") ||
    host.includes("dicionario.priberam.org") ||
    host.includes("dicionario.info") ||
    host.includes("portuguesaletra.com")
  );
}

function dedupeUrls(results: Array<InternetSearchResponse["results"][number]>, maxItems: number) {
  const unique: Array<InternetSearchResponse["results"][number]> = [];
  const seen = new Set<string>();
  for (const row of results) {
    const normalizedRow = normalizeSearchResultRow(row);
    const url = `${normalizedRow.url || ""}`.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    unique.push(normalizedRow);
    if (unique.length >= maxItems) break;
  }
  return unique;
}

const OFFICE_STOPWORDS = new Set([
  "qual",
  "quem",
  "nome",
  "atual",
  "current",
  "do",
  "da",
  "de",
  "dos",
  "das",
  "o",
  "a",
  "os",
  "as",
  "e",
  "the",
  "of",
  "is",
  "sao",
  "sao",
]);

function extractOfficeScopeTokens(prompt: string) {
  const stripped = stripAutoSearchPreamble(prompt);
  const normalized = normalizeForVerification(stripped);
  if (!normalized) return [];
  const officeWords = new Set(["governador", "prefeito", "presidente", "ministro", "reitor", "ceo", "rector", "chancellor"]);
  const tokens = normalized
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !OFFICE_STOPWORDS.has(token) && !officeWords.has(token));
  return Array.from(new Set(tokens)).slice(0, 5);
}

function rowMatchesOfficeScope(row: InternetSearchResponse["results"][number], scopeTokens: string[]) {
  if (!scopeTokens.length) return true;
  const haystack = normalizeForVerification(`${row.title || ""} ${row.snippet || ""} ${row.url || ""}`);
  const matchedTokens = scopeTokens.filter((token) => {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`);
    return pattern.test(haystack);
  });
  const minimumMatches = Math.min(2, scopeTokens.length);
  return matchedTokens.length >= minimumMatches;
}

function normalizeOfficeCandidateName(raw: string) {
  let value = `${raw || ""}`.trim();
  if (!value) return "";
  value = value.replace(/\[[^\]]+\]/g, " ");
  value = value.replace(/\([^)]+\)/g, " ");
  value = value.replace(/<[^>]+>/g, " ");
  value = value.replace(/["'`]/g, "");
  value = value.replace(/\s+/g, " ").trim();
  if (!/[A-Z]/.test(value)) {
    value = value.replace(/\b(\p{L})(\p{L}*)\b/gu, (_match, first: string, rest: string) => {
      return `${first.toUpperCase()}${rest.toLowerCase()}`;
    });
  }
  if (value.length < 3) return "";
  return value.slice(0, 120);
}

function isLikelyOfficeHolderName(candidate: string) {
  const value = `${candidate || ""}`.trim();
  if (!value || value.length < 4) return false;
  if (/\d/.test(value)) return false;
  const normalized = normalizeForVerification(value);
  if (!normalized) return false;
  const blockedTerms = [
    "reconduzido",
    "reeleito",
    "eleito",
    "incumbente",
    "titular",
    "atual",
    "prefeito",
    "governador",
    "presidente",
    "ministro",
    "mandato",
    "governo",
  ];
  if (blockedTerms.some((term) => normalized.includes(term))) return false;

  const connectorPattern = /^(da|de|do|das|dos|e|d'|del|la|el)$/i;
  const tokens = value
    .split(/\s+/g)
    .map((token) => token.replace(/^[^\p{L}]+|[^\p{L}.'-]+$/gu, ""))
    .filter(Boolean);
  if (!tokens.length) return false;
  const significant = tokens.filter((token) => !connectorPattern.test(token));
  if (significant.length < 2) return false;
  const blockedNameTokens = new Set([
    "lei",
    "acesso",
    "informacao",
    "secretaria",
    "prefeitura",
    "municipio",
    "municipal",
    "cidade",
    "estado",
    "governo",
    "portal",
    "oficial",
    "noticia",
    "eleicao",
    "eleicoes",
    "mandato",
    "prefeito",
    "governador",
    "presidente",
    "rio",
    "branco",
    "acre",
  ]);
  for (const token of significant) {
    const normalizedToken = normalizeForVerification(token).replace(/[^a-z]/g, "");
    if (!normalizedToken) continue;
    if (blockedNameTokens.has(normalizedToken)) return false;
  }

  let uppercaseLike = 0;
  for (const token of significant) {
    const clean = token.replace(/\.+$/g, "");
    if (!clean) continue;
    const looksNamePart = /^\p{Lu}[\p{L}'.-]*$/u.test(clean) || /^\p{Lu}\.$/u.test(clean);
    if (!looksNamePart) return false;
    uppercaseLike += 1;
  }
  return uppercaseLike >= 2;
}

function stripWikipediaMarkup(value: string) {
  let output = `${value || ""}`;
  if (!output) return "";
  output = output.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, " ");
  output = output.replace(/<[^>]+>/g, " ");
  output = output.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2");
  output = output.replace(/\[\[([^\]]+)\]\]/g, "$1");
  output = output.replace(/\{\{[^{}]*\}\}/g, " ");
  output = output.replace(/''+/g, "");
  output = output.replace(/\|/g, " ");
  output = output.replace(/\s+/g, " ").trim();
  return output;
}

function extractWikipediaTitleFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("wikipedia.org")) return "";
    const prefix = "/wiki/";
    const index = parsed.pathname.indexOf(prefix);
    if (index < 0) return "";
    return decodeURIComponent(parsed.pathname.slice(index + prefix.length) || "").trim();
  } catch {
    return "";
  }
}

async function fetchWikipediaOfficeCandidateFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("wikipedia.org")) return "";
    const language = parsed.hostname.startsWith("pt.") ? "pt" : "en";
    const title = extractWikipediaTitleFromUrl(url);
    if (!title) return "";
    const endpoint =
      `https://${language}.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main` +
      `&formatversion=2&format=json&titles=${encodeURIComponent(title)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4_000);
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          "User-Agent": "knexit-rag/1.0 (+https://knexit.local)",
          Accept: "application/json",
        },
      });
      if (!response.ok) return "";
      const payload = (await response.json()) as {
        query?: { pages?: Array<{ revisions?: Array<{ slots?: { main?: { content?: string } } }> }> };
      };
      const wikiText = payload?.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content || "";
      if (!wikiText) return "";
      const patterns = [
        /\|\s*incumbente\s*=\s*([^\n]+)/i,
        /\|\s*incumbent\s*=\s*([^\n]+)/i,
        /\|\s*titular\s*=\s*([^\n]+)/i,
        /\|\s*prefeito(?:a)?\s*=\s*([^\n]+)/i,
        /\|\s*governador(?:a)?\s*=\s*([^\n]+)/i,
        /\|\s*presidente\s*=\s*([^\n]+)/i,
        /\|\s*mayor\s*=\s*([^\n]+)/i,
        /\|\s*governor\s*=\s*([^\n]+)/i,
      ];
      for (const pattern of patterns) {
        const match = wikiText.match(pattern);
        const candidate = normalizeOfficeCandidateName(stripWikipediaMarkup(match?.[1] || ""));
        if (candidate && isLikelyOfficeHolderName(candidate)) return candidate;
      }
      return "";
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    return "";
  }
}

async function recoverOfficeCandidatesFromWikipedia(rows: Array<InternetSearchResponse["results"][number]>) {
  const wikipediaUrls = Array.from(
    new Set(
      rows
        .map((row) => `${row.url || ""}`.trim())
        .filter((url) => url.includes("wikipedia.org/wiki/")),
    ),
  ).slice(0, 3);
  if (!wikipediaUrls.length) return [];
  const candidates = await Promise.all(wikipediaUrls.map((url) => fetchWikipediaOfficeCandidateFromUrl(url)));
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const normalized = normalizeForVerification(candidate);
    if (!candidate || !normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(candidate);
  }
  return unique;
}

function scoreOfficeCandidate(candidate: string, rows: Array<InternetSearchResponse["results"][number]>) {
  const normalizedCandidate = normalizeForVerification(candidate);
  if (!normalizedCandidate) return 0;
  let score = 0;
  for (const row of rows) {
    const haystack = normalizeForVerification(`${row.title || ""} ${row.snippet || ""}`);
    if (!haystack || !haystack.includes(normalizedCandidate)) continue;
    score += 2;
    if (/\b(atual|incumbente|incumbent|titular|desde|current)\b/.test(haystack)) score += 2;
    if (/\b(governador|prefeito|presidente|ministro|reitor|governor|president|minister|rector)\b/.test(haystack)) score += 1;
    if (isTrustedOfficeDomain(extractHostname(row.url))) score += 2;
  }
  return score;
}

function collapseOfficeCandidatesByConsensus(
  candidates: string[],
  rows: Array<InternetSearchResponse["results"][number]>,
) {
  if (candidates.length <= 1) return candidates;
  const scored = candidates
    .map((candidate) => ({
      candidate,
      score: scoreOfficeCandidate(candidate, rows),
    }))
    .sort((left, right) => right.score - left.score);
  const top = scored[0];
  const second = scored[1];
  if (!top) return [];
  const hasStrongTopScore = top.score >= 4;
  const hasClearMargin = !second || top.score >= second.score + 2;
  if (hasStrongTopScore && hasClearMargin) {
    return [top.candidate];
  }
  return candidates;
}

function extractOfficeCandidates(prompt: string, rows: Array<InternetSearchResponse["results"][number]>) {
  if (!isOfficeContextPrompt(prompt)) return [];
  const scopeTokens = extractOfficeScopeTokens(prompt);
  const requiresCurrentSignal = isCurrentOfficeQuestion(prompt);
  const names: string[] = [];
  const seen = new Set<string>();
  const patterns = [
    /Titular atual:\s*([^.;,\n]+)/i,
    /incumbente\s*[:\-]\s*([^.;,\n]+)/i,
    /(?:presidencia|presid\u00EAncia)\s+da\s+republica[^.\n]{0,80}?(?:\u00E9|e|:)\s+([\p{L}][\p{L}'.-]{1,40}(?:\s+[\p{L}][\p{L}'.-]{1,40}){1,4})/iu,
    /([\p{L}][\p{L}'.-]{1,40}(?:\s+[\p{L}][\p{L}'.-]{1,40}){1,4})\s*[-|]\s*(?:presidencia|presid\u00EAncia)\s+da\s+republica/iu,
    /(?:governador|prefeito|presidente|ministro|reitor)[^.\n]{0,80}?\s(?:\u00E9|e|:)\s+([\p{L}][\p{L}'.-]{1,40}(?:\s+[\p{L}][\p{L}'.-]{1,40}){1,4})/iu,
    /([\p{L}][\p{L}'.-]{1,40}(?:\s+[\p{L}][\p{L}'.-]{1,40}){1,4})[^.\n]{0,80}\b(?:prefeito|governador|presidente|ministro|reitor)\b/iu,
  ];
  for (const row of rows) {
    if (!rowMatchesOfficeScope(row, scopeTokens)) continue;
    const combined = `${row.title || ""}. ${row.snippet || ""}`;
    const normalizedCombined = normalizeForVerification(combined);
    const hasCurrentSignal = /\b(atual|current|incumbente|incumbent|titular|em exercicio|in office|verificado em|verified at)\b/.test(
      normalizedCombined,
    );
    for (const pattern of patterns) {
      const match = combined.match(pattern);
      const candidate = normalizeOfficeCandidateName(match?.[1] || "");
      if (!candidate) continue;
      if (!isLikelyOfficeHolderName(candidate)) continue;
      if (requiresCurrentSignal && !hasCurrentSignal && !/(?:titular atual|incumbente)/i.test(combined)) continue;
      const normalized = normalizeForVerification(candidate);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      names.push(candidate);
      break;
    }
  }
  return names;
}

function hasMeaningfulSearchScopeForAutoSearch(value: string) {
  const normalized = normalizeForVerification(value);
  if (!normalized) return false;
  if (
    /\b(presidente|prefeito|governador|ministro|reitor|ceo|rector|chancellor|usa|eua|united states|estados unidos|brasil|brazil|acre)\b/.test(
      normalized,
    )
  ) {
    return true;
  }
  const stopwords = new Set([
    "a",
    "as",
    "atual",
    "current",
    "da",
    "das",
    "de",
    "do",
    "dos",
    "e",
    "eh",
    "is",
    "me",
    "nome",
    "o",
    "of",
    "os",
    "qual",
    "que",
    "quem",
    "saber",
    "the",
  ]);
  const tokens = normalized
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !stopwords.has(token));
  return tokens.length >= 2;
}

function stripAutoSearchPreamble(prompt: string) {
  let value = `${prompt || ""}`.trim().replace(/\s+/g, " ");
  if (!value) return "";
  const patterns = [
    /^(?:por favor[,:\s-]*)?(?:preciso|quero|gostaria)\s+que\s+(?:voce|vc)\s+(?:me\s+)?(?:diga|informe|responda)\s+/i,
    /^(?:por favor[,:\s-]*)?(?:preciso|quero|gostaria)\s+que\s+(?:me\s+)?(?:diga|informe|responda)\s+/i,
    /^(?:por favor[,:\s-]*)?(?:preciso|quero|gostaria)\s+que\s+(?:voce|vc)\s+(?:me\s+)?d(?:e|\u00EA)\s+o\s+nome\s+(?:do|da|de)\s+/i,
    /^(?:por favor[,:\s-]*)?(?:preciso|quero|gostaria)\s+que\s+(?:me\s+)?d(?:e|\u00EA)\s+o\s+nome\s+(?:do|da|de)\s+/i,
    /^(?:por favor[,:\s-]*)?(?:preciso|quero|gostaria)\s+saber\s+(?:o\s+nome\s+)?(?:do|da|de)\s+/i,
    /^(?:por favor[,:\s-]*)?(?:voce|vc)\s+pode\s+(?:me\s+)?(?:dizer|informar|responder)\s+/i,
    /^(?:por favor[,:\s-]*)?pode\s+(?:me\s+)?(?:dizer|informar|responder)\s+/i,
    /^(?:por favor[,:\s-]*)?me\s+(?:diga|informe|responda)\s+/i,
    /^(?:e\s+)?(?:o|a)\s+atual\s+/i,
    /^(?:me\s+d(?:e|\u00EA)\s+o\s+nome\s+(?:do|da|de)\s+)/i,
    /^(?:e\s+o\s+nome\s+(?:do|da|de)\s+)/i,
    /^(?:qual\s+(?:e|eh|\u00E9)\s+(?:o|a)\s+nome\s+(?:do|da|de)\s+)/i,
    /^(?:qual\s+o\s+nome\s+(?:do|da|de)\s+)/i,
    /^(?:quem\s+(?:e|eh|\u00E9)\s+(?:o|a)\s+)/i,
  ];
  for (const pattern of patterns) {
    value = value.replace(pattern, "");
  }
  const stripped = value.trim();
  if (!stripped) return "";
  return hasMeaningfulSearchScopeForAutoSearch(stripped) ? stripped : `${prompt || ""}`.trim();
}

function normalizePromptWhitespace(value: string) {
  return `${value || ""}`.replace(/\s+/g, " ").trim();
}

function extractOfficeScopePhrase(prompt: string) {
  const stripped = stripAutoSearchPreamble(prompt);
  const normalized = normalizePromptWhitespace(stripped);
  if (!normalized) return "";
  const match = normalized.match(/\b(?:prefeito|governador|presidente|ministro|reitor)\s+(?:de|do|da)\s+(.+)$/i);
  if (!match) return "";
  return normalizePromptWhitespace((match[1] || "").replace(/\b(atual|hoje|agora)\b/gi, "")).slice(0, 96);
}

function extractOfficeRoleKeyword(prompt: string) {
  const stripped = stripAutoSearchPreamble(prompt);
  const normalized = normalizeForVerification(stripped);
  if (!normalized) return "";
  const match = normalized.match(/\b(prefeito|governador|presidente|ministro|reitor)\b/);
  return (match?.[1] || "").trim();
}

function buildAutoSearchQueries(prompt: string) {
  const raw = `${prompt || ""}`.trim();
  if (!raw) return [];
  const base = stripAutoSearchPreamble(raw) || raw;
  const scopePhrase = extractOfficeScopePhrase(base);
  const officeRole = extractOfficeRoleKeyword(base);
  const maxQueries = Number.isFinite(Number(process.env.KNEXAI_AUTO_WEB_SEARCH_QUERIES))
    ? Math.max(1, Math.min(5, Math.trunc(Number(process.env.KNEXAI_AUTO_WEB_SEARCH_QUERIES))))
    : 4;
  const normalized = normalizeForVerification(base);
  const asksOfficeContext = isOfficeContextPrompt(base);
  const asksUsOffice = asksOfficeContext && isUsOfficeQuestion(base);
  const asksBrazilOffice = asksOfficeContext && isBrazilOfficeQuestion(base);
  const candidates = asksUsOffice
    ? [
        base,
        "current president of the united states site:whitehouse.gov",
        `${base} site:wikipedia.org`,
        "president of the united states wikipedia incumbent",
        "current president of the united states site:reuters.com",
        "current president of the united states site:apnews.com",
        `${base} site:whitehouse.gov`,
        `${base} site:reuters.com`,
        `${base} site:apnews.com`,
        `${base} site:bbc.com`,
        `${base} site:wikipedia.org`,
        `${base} latest`,
        `${base} atualizado`,
      ]
    : asksBrazilOffice
      ? [
          base,
          `"${base}"`,
          scopePhrase && officeRole === "prefeito" ? `prefeito de ${scopePhrase} prefeitura` : "",
          scopePhrase && officeRole ? `${officeRole} de ${scopePhrase} site:gov.br` : "",
          scopePhrase && officeRole ? `${officeRole} de ${scopePhrase} site:wikipedia.org` : "",
          officeRole === "presidente" ? "presidencia da republica brasil site:gov.br" : "",
          scopePhrase ? `${scopePhrase} site:wikipedia.org` : "",
          `${base} prefeitura`,
          `${base} site:wikipedia.org`,
          `${base} site:gov.br`,
          `${base} site:agenciabrasil.ebc.com.br`,
          `${base} site:g1.globo.com`,
          `${base} site:uol.com.br`,
          `${base} site:cnnbrasil.com.br`,
          `${base} atualizado`,
          `${base} governo`,
          `${base} titular atual`,
        ]
    : [
        base,
        `${base} site:.gov`,
        `${base} site:gov.br`,
        `${base} site:reuters.com`,
        `${base} site:apnews.com`,
        `${base} site:bbc.com`,
        `${base} site:wikipedia.org`,
        `${base} latest`,
        `${base} atualizado`,
      ];
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const query of candidates) {
    const normalized = query.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(query.trim());
    if (unique.length >= maxQueries) break;
  }
  return unique;
}

function stripSearchOperatorsFromQuery(value: string) {
  return `${value || ""}`
    .replace(/\bsite:[^\s]+/gi, " ")
    .replace(/\bfiletype:[^\s]+/gi, " ")
    .replace(/\binurl:[^\s]+/gi, " ")
    .replace(/\bintitle:[^\s]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildAutoSearchRecoveryQueries(prompt: string, attemptedQueries: string[]) {
  const maxRecoveryQueries = Number.isFinite(Number(process.env.KNEXAI_AUTO_WEB_SEARCH_RECOVERY_QUERIES))
    ? Math.max(1, Math.min(8, Math.trunc(Number(process.env.KNEXAI_AUTO_WEB_SEARCH_RECOVERY_QUERIES))))
    : 4;
  const base = stripAutoSearchPreamble(prompt) || prompt.trim();
  const scopePhrase = extractOfficeScopePhrase(base);
  const officeRole = extractOfficeRoleKeyword(base);
  const normalizedPrompt = normalizeForVerification(base);
  const currentOfficeQuestion = isOfficeContextPrompt(base);
  const asksUsOffice = currentOfficeQuestion && isUsOfficeQuestion(base);
  const asksBrazilOffice = currentOfficeQuestion && isBrazilOfficeQuestion(base);
  const candidates: string[] = [
    stripSearchOperatorsFromQuery(base),
    `${stripSearchOperatorsFromQuery(base)} wikipedia`,
    `${stripSearchOperatorsFromQuery(base)} titular atual`,
    `${stripSearchOperatorsFromQuery(base)} incumbente`,
    `${stripSearchOperatorsFromQuery(base)} hoje`,
  ];

  if (asksUsOffice) {
    candidates.push(
      "who is the current president of the united states",
      "president of the united states incumbent wikipedia",
      "current president united states whitehouse",
    );
  }
  if (asksBrazilOffice) {
    candidates.push(
      scopePhrase && officeRole === "prefeito" ? `prefeito de ${scopePhrase} prefeitura` : "",
      scopePhrase && officeRole ? `${officeRole} de ${scopePhrase} site:gov.br` : "",
      scopePhrase && officeRole ? `${officeRole} de ${scopePhrase} site:wikipedia.org` : "",
      officeRole === "presidente" ? "presidencia da republica brasil site:gov.br" : "",
      scopePhrase ? `${scopePhrase} site:wikipedia.org` : "",
      `${stripSearchOperatorsFromQuery(base)} site:gov.br`,
      `${stripSearchOperatorsFromQuery(base)} site:wikipedia.org`,
      `${stripSearchOperatorsFromQuery(base)} governo`,
    );
  }
  if (!currentOfficeQuestion && normalizedPrompt) {
    candidates.push(`${stripSearchOperatorsFromQuery(base)} source`, `${stripSearchOperatorsFromQuery(base)} official source`);
  }

  const attempted = new Set(
    attemptedQueries
      .map((query) => query.trim().toLowerCase())
      .filter(Boolean),
  );
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const query = `${candidate || ""}`.trim();
    if (!query) continue;
    const normalized = query.toLowerCase();
    if (seen.has(normalized) || attempted.has(normalized)) continue;
    seen.add(normalized);
    unique.push(query);
    if (unique.length >= maxRecoveryQueries) break;
  }
  return unique;
}

async function collectAutomaticWebResults(queries: string[]) {
  const allResults: Array<InternetSearchResponse["results"][number]> = [];
  const providers = new Set<string>();
  const executedQueries: string[] = [];
  const payloads = await Promise.allSettled(
    queries.map((query) => internetSearchService.search({ query, preferPdf: false })),
  );
  for (let index = 0; index < payloads.length; index += 1) {
    const result = payloads[index];
    const query = queries[index] || "";
    if (!query) continue;
    executedQueries.push(query);
    if (result.status === "rejected") {
      console.warn("KNEXAI_AUTO_WEB_SEARCH_QUERY_FAILED", {
        query,
        message: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
      continue;
    }
    const payload = result.value;
    if (!payload) continue;
    for (const provider of payload.providersUsed || []) {
      if (provider) providers.add(provider);
    }
    if (payload.provider && payload.provider !== "multi") {
      providers.add(payload.provider);
    }
    if (!Array.isArray(payload.results) || !payload.results.length) continue;
    allResults.push(...payload.results);
  }
  return {
    allResults,
    providers: Array.from(providers),
    executedQueries,
  };
}

async function buildAutomaticWebEvidence(prompt: string): Promise<AutoWebEvidence | null> {
  const autoEnabled = parseOptionalBoolean(process.env.KNEXAI_AUTO_WEB_SEARCH_ENABLED) !== false;
  const forceMultiSource = parseOptionalBoolean(process.env.KNEXAI_FORCE_MULTI_SOURCE_WEB_SEARCH) !== false;
  if (!autoEnabled) return null;
  if (!internetSearchService.isEnabled()) return null;
  const shouldSearchThisPrompt = isVerifiableQuestionForAutoSearch(prompt) || isVerificationFollowUpPrompt(prompt);
  if (!shouldSearchThisPrompt) return null;

  const primaryQueries = buildAutoSearchQueries(prompt);
  if (!primaryQueries.length) return null;

  const minDistinctDomains = forceMultiSource ? 2 : 1;
  const minProviderCoverage = forceMultiSource ? 2 : 1;
  let aggregatedResults = await collectAutomaticWebResults(primaryQueries);
  const shouldRecover =
    parseOptionalBoolean(process.env.KNEXAI_AUTO_WEB_SEARCH_ENABLE_RECOVERY) !== false;
  if (shouldRecover) {
    const previewRows = dedupeUrls(aggregatedResults.allResults, 16);
    const previewDomains = new Set(previewRows.map((row) => extractHostname(row.url)).filter(Boolean));
    const needsRecovery =
      previewRows.length < Math.max(2, minDistinctDomains) ||
      previewDomains.size < minDistinctDomains ||
      aggregatedResults.providers.length < minProviderCoverage;
    if (needsRecovery) {
      const recoveryQueries = buildAutoSearchRecoveryQueries(prompt, aggregatedResults.executedQueries);
      if (recoveryQueries.length) {
        console.info("KNEXAI_AUTO_WEB_SEARCH_RECOVERY", {
          prompt,
          reason: {
            resultCount: previewRows.length,
            domainCount: previewDomains.size,
            providerCount: aggregatedResults.providers.length,
            minDistinctDomains,
            minProviderCoverage,
          },
          recoveryQueries,
        });
        const recoveryResults = await collectAutomaticWebResults(recoveryQueries);
        aggregatedResults = {
          allResults: [...aggregatedResults.allResults, ...recoveryResults.allResults],
          providers: Array.from(new Set([...aggregatedResults.providers, ...recoveryResults.providers])),
          executedQueries: [...aggregatedResults.executedQueries, ...recoveryResults.executedQueries],
        };
      }
    }
  }

  const allResults = aggregatedResults.allResults;
  const executedQueryCount = aggregatedResults.executedQueries.length;
  if (!allResults.length) {
    if (!forceMultiSource) return null;
    const missingBlock = [
      "[WEB_VERIFIED_CONTEXT]",
      `Pergunta: ${prompt.trim()}`,
      `Consultas executadas: ${executedQueryCount}`,
      "Status: nenhuma fonte web recuperada neste turno.",
      "Regra: nao responder fato verificavel por memoria; informar falha de verificacao web e solicitar nova tentativa.",
      "[/WEB_VERIFIED_CONTEXT]",
    ].join("\n");
    return {
      contextBlock: missingBlock,
      queryCount: executedQueryCount,
      resultCount: 0,
      sources: [],
      domainCount: 0,
      officeCandidates: [],
    };
  }

  const maxResults = Number.isFinite(Number(process.env.KNEXAI_AUTO_WEB_SEARCH_MAX_RESULTS))
    ? Math.max(2, Math.min(12, Math.trunc(Number(process.env.KNEXAI_AUTO_WEB_SEARCH_MAX_RESULTS))))
    : 8;
  let selected = dedupeUrls(allResults, Math.max(24, maxResults * 3));
  if (!selected.length) return null;
  const highSignalSelected = selected.filter((row) => !isLowSignalDomain(extractHostname(row.url)));
  if (highSignalSelected.length) {
    selected = highSignalSelected;
  }
  const officeContextQuestion = isOfficeContextPrompt(prompt);
  const currentOfficeQuestion = isCurrentOfficeQuestion(prompt);
  const strictOfficeSourceFilter = parseOptionalBoolean(process.env.KNEXAI_OFFICE_STRICT_SOURCE_FILTER) !== false;
  const officeRole = officeContextQuestion ? extractOfficeRoleKeyword(prompt) : "";
  if (officeContextQuestion) {
    const isUsQuestion = isUsOfficeQuestion(prompt);
    const trustedSelected = selected.filter((row) => isTrustedOfficeDomain(extractHostname(row.url)));
    const minTrustedForOffice = isUsQuestion ? 2 : 1;
    if (trustedSelected.length >= minTrustedForOffice) {
      const byDomain = new Map<string, InternetSearchResponse["results"][number]>();
      const diversified: InternetSearchResponse["results"][number][] = [];
      for (const row of trustedSelected) {
        const domain = extractHostname(row.url);
        if (!domain || byDomain.has(domain)) continue;
        byDomain.set(domain, row);
        diversified.push(row);
      }
      const remainder = trustedSelected.filter((row) => !diversified.includes(row));
      selected = [...diversified, ...remainder];
    } else if (forceMultiSource && isUsQuestion) {
      const trustedInsufficientBlock = [
        "[WEB_VERIFIED_CONTEXT]",
        `Pergunta: ${prompt.trim()}`,
        `Consultas executadas: ${executedQueryCount}`,
        "Status: fontes de autoridade insuficientes para confirmar cargo atual.",
        "Regra: nao responder fato verificavel por memoria; solicitar nova tentativa de verificacao.",
        "[/WEB_VERIFIED_CONTEXT]",
      ].join("\n");
      return {
        contextBlock: trustedInsufficientBlock,
        queryCount: executedQueryCount,
        resultCount: 0,
        sources: selected.map((row) => `${row.url || ""}`.trim()).filter(Boolean),
        domainCount: 0,
        officeCandidates: [],
      };
    }
  }
  if (officeContextQuestion) {
    const scopeTokens = extractOfficeScopeTokens(prompt);
    const scopedPreview = selected.slice(0, 8).map((row) => {
      const haystack = normalizeForVerification(`${row.title || ""} ${row.snippet || ""} ${row.url || ""}`);
      const matchedTokens = scopeTokens.filter((token) => {
        const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const pattern = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`);
        return pattern.test(haystack);
      });
      return {
        url: row.url,
        matchedTokens,
      };
    });
    console.info("KNEXAI_OFFICE_SCOPE_FILTER", {
      prompt,
      scopeTokens,
      preview: scopedPreview,
    });
    const scopeFiltered = selected.filter((row) => {
      if (!rowMatchesOfficeScope(row, scopeTokens)) return false;
      if (!strictOfficeSourceFilter) return true;
      return hasOfficeRoleSignal(row, officeRole);
    });
    selected = scopeFiltered;
  }
  if (!selected.length && officeContextQuestion) {
    const scopedInsufficientBlock = [
      "[WEB_VERIFIED_CONTEXT]",
      `Pergunta: ${prompt.trim()}`,
      `Consultas executadas: ${executedQueryCount}`,
      "Status: resultados sem aderencia ao escopo geografico/tematico da pergunta.",
      "Regra: nao responder fato verificavel por memoria; solicitar nova tentativa de verificacao.",
      "[/WEB_VERIFIED_CONTEXT]",
    ].join("\n");
    return {
      contextBlock: scopedInsufficientBlock,
      queryCount: executedQueryCount,
      resultCount: 0,
      sources: [],
      domainCount: 0,
      officeCandidates: [],
    };
  }
  if (officeContextQuestion && strictOfficeSourceFilter) {
    const officialRows = selected.filter((row) => isOfficialGovernmentDomain(extractHostname(row.url)));
    if (officialRows.length) {
      const reliableRows = selected.filter(
        (row) =>
          !isOfficialGovernmentDomain(extractHostname(row.url)) &&
          isTrustedOfficeDomain(extractHostname(row.url)),
      );
      const limitedReliableRows = reliableRows.slice(0, 2);
      selected = [...officialRows, ...limitedReliableRows];
    }
    selected = selected
      .map((row) => ({
        row,
        score: scoreOfficeSourceRow(row, officeRole, currentOfficeQuestion),
      }))
      .sort((left, right) => right.score - left.score)
      .map((item) => item.row);
  }
  selected = selected.slice(0, maxResults);
  if (currentOfficeQuestion) {
    const requiresPrimaryAuthority = parseOptionalBoolean(process.env.KNEXAI_REQUIRE_PRIMARY_AUTHORITY_FOR_CURRENT_OFFICE) !== false;
    if (requiresPrimaryAuthority) {
      const hasPrimaryAuthority = selected.some((row) => isPrimaryAuthorityOfficeDomain(extractHostname(row.url)));
      if (!hasPrimaryAuthority) {
        const primaryAuthorityBlock = [
          "[WEB_VERIFIED_CONTEXT]",
          `Pergunta: ${prompt.trim()}`,
          `Consultas executadas: ${executedQueryCount}`,
          "Status: fontes primarias de autoridade insuficientes para confirmar titular atual.",
          "Regra: nao responder fato verificavel por memoria; solicitar nova tentativa de verificacao.",
          "[/WEB_VERIFIED_CONTEXT]",
        ].join("\n");
        return {
          contextBlock: primaryAuthorityBlock,
          queryCount: executedQueryCount,
          resultCount: 0,
          sources: selected.map((row) => `${row.url || ""}`.trim()).filter(Boolean),
          domainCount: 0,
          officeCandidates: [],
        };
      }
    }
  }
  const selectedDomains = Array.from(new Set(selected.map((row) => extractHostname(row.url)).filter(Boolean)));
  const hasTrustedAuthority = selected.some((row) => isTrustedOfficeDomain(extractHostname(row.url)));
  let officeCandidates = extractOfficeCandidates(prompt, selected);
  if (!officeCandidates.length && officeContextQuestion) {
    const recovered = await recoverOfficeCandidatesFromWikipedia(selected);
    if (recovered.length) {
      officeCandidates = recovered;
    }
  }
  officeCandidates = collapseOfficeCandidatesByConsensus(officeCandidates, selected);
  if (!officeCandidates.length && officeContextQuestion) {
    console.info("KNEXAI_OFFICE_CANDIDATE_EMPTY_SAMPLE", {
      prompt,
      samples: selected.slice(0, 5).map((row) => ({
        title: `${row.title || ""}`.slice(0, 180),
        snippet: `${row.snippet || ""}`.slice(0, 220),
        url: row.url,
      })),
    });
  }
  if (selectedDomains.length < minDistinctDomains) {
    if (officeContextQuestion && hasTrustedAuthority) {
      const lines: string[] = [];
      lines.push("[WEB_VERIFIED_CONTEXT]");
      lines.push(`Pergunta: ${prompt.trim()}`);
      lines.push(`Consultas executadas: ${executedQueryCount}`);
      lines.push(
        `Status: cobertura parcial (${selectedDomains.length}/${minDistinctDomains} dominios), com ao menos uma fonte de autoridade.`,
      );
      selected.forEach((row, index) => {
        const title = `${row.title || `Fonte ${index + 1}`}`.trim();
        const snippet = `${row.snippet || ""}`.trim();
        lines.push(`${index + 1}. ${title}`);
        lines.push(`URL: ${row.url}`);
        if (snippet) lines.push(`Trecho: ${snippet}`);
      });
      lines.push("[/WEB_VERIFIED_CONTEXT]");
      return {
        contextBlock: lines.join("\n"),
        queryCount: executedQueryCount,
        resultCount: selected.length,
        sources: selected.map((row) => `${row.url || ""}`.trim()).filter(Boolean),
        domainCount: selectedDomains.length,
        officeCandidates,
      };
    }
    const insufficientBlock = [
      "[WEB_VERIFIED_CONTEXT]",
      `Pergunta: ${prompt.trim()}`,
      `Consultas executadas: ${executedQueryCount}`,
      `Status: fontes insuficientes para validacao multifonte (${selectedDomains.length}/${minDistinctDomains} dominios distintos).`,
      "Regra: nao responder fato verificavel por memoria; solicitar nova tentativa de verificacao.",
      "[/WEB_VERIFIED_CONTEXT]",
    ].join("\n");
    return {
      contextBlock: insufficientBlock,
      queryCount: executedQueryCount,
      resultCount: 0,
      sources: selected.map((row) => `${row.url || ""}`.trim()).filter(Boolean),
      domainCount: selectedDomains.length,
      officeCandidates: [],
    };
  }

  const lines: string[] = [];
  lines.push("[WEB_VERIFIED_CONTEXT]");
  lines.push(`Pergunta: ${prompt.trim()}`);
  lines.push(`Consultas executadas: ${executedQueryCount}`);
  selected.forEach((row, index) => {
    const title = `${row.title || `Fonte ${index + 1}`}`.trim();
    const snippet = `${row.snippet || ""}`.trim();
    lines.push(`${index + 1}. ${title}`);
    lines.push(`URL: ${row.url}`);
    if (snippet) lines.push(`Trecho: ${snippet}`);
  });
  lines.push("[/WEB_VERIFIED_CONTEXT]");

  return {
    contextBlock: lines.join("\n"),
    queryCount: executedQueryCount,
    resultCount: selected.length,
    sources: selected.map((row) => `${row.url || ""}`.trim()).filter(Boolean),
    domainCount: selectedDomains.length,
    officeCandidates,
  };
}

function resolveLogicalModelName() {
  const explicit = pickFirstNonEmpty(process.env.LLM_MODEL_NAME);
  if (explicit) return explicit;

  const compatModel = pickFirstNonEmpty(process.env.VLLM_MODEL);
  // VLLM_MODEL historicamente pode receber caminho de disco. No payload OpenAI-like, usar nome logico.
  if (compatModel && !compatModel.includes("/") && !compatModel.includes("\\")) return compatModel;

  return DEFAULT_MODEL;
}

function resolveModelFallbacks(primaryModel: string) {
  const pathConfig = loadPathConfig();
  const localModelPath = pickFirstNonEmpty(process.env.LOCAL_LLM_MODEL, pathConfig.localLlmModelDefaultPath);
  const localModelPathBasename = localModelPath.replace(/\\/g, "/").split("/").filter(Boolean).pop() || "";
  const candidates = [
    pickFirstNonEmpty(process.env.VLLM_MODEL),
    localModelPath,
    localModelPathBasename,
    pathConfig.localLlmModelDefaultPath,
  ]
    .map((value) => value.trim())
    .filter(Boolean);
  return Array.from(new Set(candidates)).filter((value) => value !== primaryModel);
}

class LlmRouteError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function readLlmConfig(): LlmConfig {
  const hostOnly = parseBooleanFlag(process.env.KNEXAI_LLM_HOST_ONLY, true);
  const resolvedBaseUrl = normalizeUrl(
    pickFirstNonEmpty(process.env.LOCAL_LLM_BASE_URL, process.env.LLM_BASE_URL, process.env.VLLM_BASE_URL, DEFAULT_BASE_URL),
  );
  const baseUrl = hostOnly ? enforceLoopbackBaseUrl(resolvedBaseUrl) : resolvedBaseUrl;
  const fallbackBaseUrls = hostOnly
    ? []
    : parseBaseUrlList(
    pickFirstNonEmpty(
      process.env.KNEXAI_LLM_FALLBACK_BASE_URLS,
      process.env.LOCAL_LLM_FALLBACK_BASE_URLS,
      process.env.LLM_FALLBACK_BASE_URLS,
      "",
    ),
  ).filter((item) => item !== baseUrl);
  const model = resolveLogicalModelName();
  const modelFallbacks = resolveModelFallbacks(model);
  const apiKey = pickFirstNonEmpty(process.env.LOCAL_LLM_API_KEY, process.env.VLLM_API_KEY, process.env.LLM_API_KEY, "token-local");
  const parsedTimeout = Number(process.env.LLM_TIMEOUT_MS || process.env.VLLM_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(parsedTimeout) ? Math.max(3_000, parsedTimeout) : DEFAULT_TIMEOUT_MS;
  const parsedContextWindow = Number(process.env.LLM_CONTEXT_WINDOW || process.env.VLLM_CONTEXT_WINDOW || DEFAULT_CONTEXT_WINDOW);
  const contextWindow = Number.isFinite(parsedContextWindow) ? Math.max(512, Math.round(parsedContextWindow)) : DEFAULT_CONTEXT_WINDOW;
  const parsedMaxTokens = Number(process.env.LLM_MAX_TOKENS || process.env.VLLM_MAX_TOKENS || DEFAULT_MAX_TOKENS);
  const requestedMaxTokens = Number.isFinite(parsedMaxTokens) ? Math.max(64, Math.round(parsedMaxTokens)) : DEFAULT_MAX_TOKENS;
  const maxByContext = Math.max(64, contextWindow - CONTEXT_RESERVE_TOKENS);
  const maxTokens = Math.min(requestedMaxTokens, maxByContext);
  return { baseUrl, fallbackBaseUrls, model, modelFallbacks, apiKey, timeoutMs, contextWindow, maxTokens, hostOnly };
}

function readEngineModeConfig(): EngineModeConfig {
  // Runtime atual: direct-only. Mantemos os campos legados apenas por compatibilidade de contrato.
  const mode: EngineMode = "direct";
  const anmBaseUrl = readConfiguredAnmBaseUrl(pickFirstNonEmpty(process.env.ANM_API_BASE_URL, DEFAULT_ANM_BASE_URL));
  const parsedAnmTimeout = Number(process.env.ANM_API_TIMEOUT_MS || DEFAULT_ANM_TIMEOUT_MS);
  const anmTimeoutMs = Number.isFinite(parsedAnmTimeout) ? Math.max(3_000, Math.round(parsedAnmTimeout)) : DEFAULT_ANM_TIMEOUT_MS;
  const parsedAnmSoftTimeout = Number(process.env.KNEXAI_ANM_SOFT_TIMEOUT_MS || DEFAULT_ANM_SOFT_TIMEOUT_MS);
  const anmSoftTimeoutMs = Number.isFinite(parsedAnmSoftTimeout)
    ? Math.max(200, Math.min(anmTimeoutMs, Math.round(parsedAnmSoftTimeout)))
    : DEFAULT_ANM_SOFT_TIMEOUT_MS;
  const fallbackRaw = pickFirstNonEmpty(process.env.KNEXAI_ANM_FALLBACK_TO_DIRECT, "1").toLowerCase();
  const fallbackToDirect = !["0", "false", "no", "off"].includes(fallbackRaw);
  return { mode, anmBaseUrl, anmTimeoutMs, anmSoftTimeoutMs, fallbackToDirect };
}

function resolveDynamicLlmFallbackUrls(seedUrls: string[]) {
  if (parseBooleanFlag(process.env.KNEXAI_LLM_HOST_ONLY, true)) return [];
  if (!parseBooleanFlag(process.env.KNEXAI_LLM_WSL_DISCOVERY_ENABLED, true)) return [];
  if (process.platform !== "win32") return [];

  const loopbackSeeds = seedUrls.filter((baseUrl) => {
    try {
      return isLoopbackHostname(new URL(baseUrl).hostname);
    } catch {
      return false;
    }
  });
  if (!loopbackSeeds.length) return [];

  const cacheKey = loopbackSeeds.join("|");
  const now = Date.now();
  if (wslDiscoveryCache && wslDiscoveryCache.key === cacheKey && now - wslDiscoveryCache.checkedAt < WSL_DISCOVERY_CACHE_MS) {
    return wslDiscoveryCache.urls;
  }

  const configuredHost = pickFirstNonEmpty(
    process.env.KNEXAI_WSL_HOST_IP,
    process.env.LOCAL_WSL_HOST_IP,
    process.env.RAG_LLM_WSL_HOST_IP,
  );
  const discoveredHosts: string[] = [];
  if (isIpv4Address(configuredHost)) {
    discoveredHosts.push(configuredHost);
  } else {
    const discoveredHost = tryDiscoverWslHostIp();
    if (isIpv4Address(discoveredHost)) {
      discoveredHosts.push(discoveredHost);
    }
  }

  const urls = Array.from(
    new Set(
      discoveredHosts.flatMap((host) =>
        loopbackSeeds
          .map((baseUrl) => replaceHostname(baseUrl, host))
          .filter(Boolean),
      ),
    ),
  );
  wslDiscoveryCache = {
    key: cacheKey,
    checkedAt: now,
    urls,
  };
  if (urls.length) {
    console.info("KNEXAI_DYNAMIC_LLM_FALLBACKS", {
      discoveredHosts,
      dynamicUrls: urls,
    });
  }
  return urls;
}

function resolveLlmBaseUrlCandidates(config: LlmConfig) {
  if (config.hostOnly) {
    return [normalizeUrl(config.baseUrl)];
  }
  const seedUrls = [
    normalizeUrl(config.baseUrl),
    ...config.fallbackBaseUrls.map((item) => normalizeUrl(item)),
  ];
  const dynamicFallbacks = resolveDynamicLlmFallbackUrls(seedUrls);
  const ordered = [...seedUrls, ...dynamicFallbacks];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const candidate of ordered) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    result.push(candidate);
  }
  return result;
}

function applyResolvedLlmBaseUrl(config: LlmConfig, baseUrl: string | null | undefined) {
  const normalized = normalizeUrl(baseUrl || "");
  if (!normalized || normalized === config.baseUrl) return config;
  return { ...config, baseUrl: normalized };
}

function safeBackendError(status: number, code: string, message: string) {
  return Response.json({ code, message }, { status });
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function describeEngineError(error: unknown) {
  if (error instanceof LlmRouteError) return `${error.code}: ${error.message}`;
  if (error instanceof Error) return error.message;
  return String(error);
}

function toAttemptOk<T>(source: "anm" | "direct", value: T): EngineAttempt<T> {
  return { source, ok: true, value };
}

function toAttemptError(source: "anm" | "direct", error: unknown): EngineAttempt<never> {
  return { source, ok: false, error };
}

async function probeEngineHealth(input: {
  url: string;
  timeoutMs: number;
  headers?: Record<string, string>;
}): Promise<EngineHealthProbeResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Math.max(200, input.timeoutMs));
  const checkedAt = Date.now();
  try {
    const response = await fetch(input.url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: input.headers || {},
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        detail: `HTTP_${response.status}`,
        checkedAt,
      };
    }
    const contentType = `${response.headers.get("content-type") || ""}`.toLowerCase();
    if (contentType.includes("application/json")) {
      try {
        const payload = (await response.json()) as { ok?: unknown; detail?: unknown; error?: unknown };
        if (payload && payload.ok === false) {
          const detail = typeof payload.detail === "string" ? payload.detail : typeof payload.error === "string" ? payload.error : "ok_false";
          return {
            ok: false,
            status: response.status,
            detail,
            checkedAt,
          };
        }
      } catch {
        // Ignore JSON parse issues in health probe and keep status-based success.
      }
    }
    return {
      ok: true,
      status: response.status,
      detail: "ok",
      checkedAt,
    };
  } catch (error) {
    return {
      ok: false,
      status: isAbortError(error) ? 504 : 0,
      detail: isAbortError(error) ? "timeout" : describeEngineError(error),
      checkedAt,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function probeAnmHealth(config: EngineModeConfig): Promise<EngineHealthProbeResult> {
  const key = `${config.anmBaseUrl}`;
  const now = Date.now();
  if (anmHealthProbeCache && anmHealthProbeCache.key === key && anmHealthProbeCache.expiresAt > now) {
    return anmHealthProbeCache.result;
  }
  const result = await probeEngineHealth({
    url: `${config.anmBaseUrl}/healthz`,
    timeoutMs: Math.min(config.anmSoftTimeoutMs, ENGINE_HEALTH_TIMEOUT_MS),
  });
  anmHealthProbeCache = {
    key,
    expiresAt: now + ENGINE_HEALTH_CACHE_TTL_MS,
    result,
  };
  return result;
}

async function probeDirectHealth(config: LlmConfig): Promise<EngineHealthProbeResult> {
  const candidates = resolveLlmBaseUrlCandidates(config);
  const key = `${candidates.join("|")}|${config.apiKey}`;
  const now = Date.now();
  if (llmHealthProbeCache && llmHealthProbeCache.key === key && llmHealthProbeCache.expiresAt > now) {
    return llmHealthProbeCache.result;
  }

  let firstFailure: EngineHealthProbeResult | null = null;
  for (const baseUrl of candidates) {
    const result = await probeEngineHealth({
      url: `${baseUrl}/models`,
      timeoutMs: Math.min(config.timeoutMs, ENGINE_HEALTH_TIMEOUT_MS),
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    const decorated: EngineHealthProbeResult = {
      ...result,
      baseUrl,
      attemptedBaseUrls: candidates,
    };
    if (decorated.ok) {
      if (baseUrl !== config.baseUrl) {
        console.warn("KNEXAI_LLM_BASEURL_FAILOVER", {
          configuredBaseUrl: config.baseUrl,
          selectedBaseUrl: baseUrl,
          attemptedBaseUrls: candidates,
        });
      }
      llmHealthProbeCache = {
        key,
        expiresAt: now + ENGINE_HEALTH_CACHE_TTL_MS,
        result: decorated,
      };
      return decorated;
    }
    if (!firstFailure) firstFailure = decorated;
  }

  const result = firstFailure || {
    ok: false,
    status: 503,
    detail: "unreachable",
    checkedAt: now,
    baseUrl: config.baseUrl,
    attemptedBaseUrls: candidates,
  };
  llmHealthProbeCache = {
    key,
    expiresAt: now + ENGINE_HEALTH_CACHE_TTL_MS,
    result,
  };
  return result;
}

function buildEngineCompositeError(attempts: Array<EngineAttempt<unknown>>) {
  const failed = attempts.filter((attempt) => !attempt.ok);
  const summary = failed
    .map((attempt) =>
      `${attempt.source.toUpperCase()}=${describeEngineError("error" in attempt ? attempt.error : "unknown_error")}`,
    )
    .join(" | ");
  return new LlmRouteError(
    503,
    "ENGINE_PATHS_UNAVAILABLE",
    summary ? `Todos os caminhos de inferencia falharam. ${summary}` : "Todos os caminhos de inferencia falharam.",
  );
}

function stripPersonaPolicyLeak(text: string) {
  const lines = `${text || ""}`
    .split(/\r?\n/g)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .filter(
      (line) =>
        !/^(?:respondo com naturalidade|respondo como uma pessoa|respondo de forma|se houver saudacao|nao uso observacoes|nao exponho processos internos|respondo curto e cordial|sou leticia|politica conversacional ativa)/i.test(
          line,
        ),
    );
  return lines.join("\n").trim();
}

function decodeLikelyMojibake(value: string): string {
  if (!/(?:Ãƒ.|Ã‚.|Ã¢[â‚¬â„¢â€œâ€â€“â€”])/.test(value)) return value;
  try {
    const bytes = Uint8Array.from(Array.from(value).map((char) => char.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const before = (value.match(/(?:Ãƒ.|Ã‚.|Ã¢[â‚¬â„¢â€œâ€â€“â€”])/g) || []).length;
    const after = (decoded.match(/(?:Ãƒ.|Ã‚.|Ã¢[â‚¬â„¢â€œâ€â€“â€”])/g) || []).length;
    return after < before && !decoded.includes("\uFFFD") ? decoded : value;
  } catch {
    return value;
  }
}

const INTERNAL_FALLBACK_LINE_PATTERNS: RegExp[] = [
  /^sem\s+ressalva(?:s)?(?:\s+(?:dominante(?:s)?|adicionais?))?[\.\!\?]*$/i,
  /^sem\s+sintese\s+disponivel[\.\!\?]*$/i,
  /^sem\s+evidencia\s+dominante[\.\!\?]*$/i,
  /^sem\s+hipotese\s+dominante[\.\!\?]*$/i,
  /^sem\s+dependencia\s+latente\s+dominante[\.\!\?]*$/i,
  /^sem\s+overclaim\s+dominante[\.\!\?]*$/i,
  /^sem\s+pressuposto\s+dominante[\.\!\?]*$/i,
  /^sem\s+caveat\s+dominante[\.\!\?]*$/i,
  /^sem\s+tensoes?\s+contextuais\s+dominantes[\.\!\?]*$/i,
];

function isInternalFallbackLine(value: string) {
  const normalized = normalizeForVerification(value);
  if (!normalized) return false;
  return INTERNAL_FALLBACK_LINE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function stripInternalFallbackMarkers(text: string) {
  let output = `${text || ""}`.trim();
  if (!output) return "";
  output = output.replace(/^[\s\S]*?traduc(?:ao|acao|ação|Ã§Ã£o)\s+para o portugues\s*:\s*/i, "");
  output = output
    .split(/\r?\n/g)
    .filter((line) => !isInternalFallbackLine(line))
    .join("\n");
  output = output.replace(/\bsem\s+ressalva(?:s)?\s+dominante(?:s)?\b/gi, " ");
  output = output.replace(/\bsem\s+ressalva(?:s)?\s+adicionais?\b/gi, " ");
  output = output.replace(/\bsem\s+sintese\s+disponivel\b/gi, " ");
  output = output.replace(/\ba resposta foi alinhada ao escopo solicitado\.\s*/gi, "");
  output = output.replace(/\bleitura inicial\s*:\s*[^.\n]*\.?/gi, " ");
  output = output.replace(
    /\bvou desenvolver isso com voce de forma progressiva,\s*separando o que esta mais consolidado do que ainda precisa de teste\.?/gi,
    " ",
  );
  output = output.replace(/\bperfil comportamental\s*:\s*[^.\n]*\.?/gi, " ");
  output = output.replace(/\bsinal epistemic[oa]\s*:\s*[^.\n]*\.?/gi, " ");
  output = output.replace(/\bconsistencia filosofica\s*:\s*[^.\n]*\.?/gi, " ");
  output = output.replace(/\bresposta\s*:\s*(?:evit|prioriz|explic|preserv|manter)[^.\n]*\.?/gi, " ");
  output = output.replace(/\bpriorizar explicitude de incerteza quando aplicavel\.?/gi, " ");
  output = output.replace(/\bevitar afirmacoes absolutas sem evidencia\.?/gi, " ");
  output = output.replace(/\blegacy-module\s*=\s*[a-z0-9_-]+[^.\n]*\.?/gi, " ");
  output = output.replace(/\bruntimeScore\s*=\s*[-\d.]+[^.\n]*\.?/gi, " ");
  output = output.replace(/texto traduzido para o espanhol\s*:\s*/gi, "");
  output = output.replace(/traduc(?:ao|acao|ação|Ã§Ã£o)\s+para o portugues\s*:\s*/gi, "");
  output = output.replace(/\bhere is the spanish text\s*:\s*/gi, "");
  output = output.replace(/\brespuesta priorizando el contexto[\s\S]*$/i, " ");
  output = output.replace(/\s*\[[^\]]*doc\s*\d+[^\]]*\]\s*/gi, " ");
  output = output.replace(/\bnota\s*:\s*algumas afirmacoes nao tiveram evidencia direta nos trechos recuperados\.?/gi, " ");
  output = output.replace(/\s{2,}/g, " ");
  output = output.replace(/\n{3,}/g, "\n\n");
  return output.trim();
}

function stripConversationRoleArtifacts(text: string) {
  let output = `${text || ""}`.trim();
  if (!output) return "";
  output = output.replace(/^\s*resposta\s*:\s*\n+/i, "");
  output = output.replace(/^\s*resposta\s*:\s*/i, "");
  output = output.replace(/^\s*(?:leticia|l\.e\.t\.i\.c\.i\.a|assistente|assistant|resposta|answer)\s*[:\-]\s*/i, "");
  output = output.replace(/\[(?:end(?:\s+of)?\s+(?:response|answer)|fim da resposta|fim da mensagem)\]/gi, " ");
  output = output.replace(/\[\s*\/?end(?:_of)?_response\s*\]/gi, " ");
  output = output.replace(/\[\s*no response intended[^\]\n]*\]?/gi, " ");
  output = output.replace(/\bno response intended(?: beyond this greeting)?\.?/gi, " ");
  output = output.replace(/<\|eot_id\|>/gi, " ");
  output = output.replace(/<\/?end(?:_of)?_response>/gi, " ");
  const markerIndex = output.search(/\b(?:usuario|user|assistente|assistant|leticia|l\.e\.t\.i\.c\.i\.a)\s*[:\-]/i);
  if (markerIndex >= 0) {
    output = output.slice(0, markerIndex).trim();
  }
  output = output
    .split(/\r?\n/g)
    .filter((line) => !/^\s*(?:referencias?|references?)\s*(?:\([^)]*\))?\s*:\s*$/i.test(line))
    .filter((line) => !/^\s*\d+\.\s*(?:internal|memory):\/\//i.test(line))
    .filter((line) => !/\b(?:internal|memory):\/\//i.test(line))
    .join("\n");
  output = stripInternalFallbackMarkers(output);
  output = decodeLikelyMojibake(output);
  output = stripPersonaPolicyLeak(output);
  output = stripInternalFallbackMarkers(output);
  output = output.replace(/\n{3,}/g, "\n\n").trim();
  return output;
}

function isLowQualityDescendingOutput(text: string, prompt: string) {
  const normalizedOutput = normalizeForVerification(stripConversationRoleArtifacts(text));
  if (!normalizedOutput) return true;
  if (/\b(warmth|casualness|empathy|restraint|stress|stability)\s*=\s*\d/.test(normalizedOutput)) return true;
  if (/^resposta\s*:\s*\d+(?:[;.,]\s*\w+)?/.test(normalizedOutput)) return true;
  if (/\bleitura inicial\b/.test(normalizedOutput)) return true;
  if (/\bperfil comportamental\b/.test(normalizedOutput)) return true;
  if (/\bsinal epistemic[oa]\b/.test(normalizedOutput)) return true;
  if (/\bconsistencia filosofica\b/.test(normalizedOutput)) return true;
  if (/\ba resposta foi alinhada ao escopo solicitado\b/.test(normalizedOutput)) return true;
  if (/\bpriorizar explicitude de incerteza quando aplicavel\b/.test(normalizedOutput)) return true;
  if (/\bevitar afirmacoes absolutas sem evidencia\b/.test(normalizedOutput)) return true;
  if (/\blegacy module\s*=|\blegacy-module\s*=|\bruntimescore\s*=/.test(normalizedOutput)) return true;
  if (/\btexto traduzido para o espanhol\b/.test(normalizedOutput)) return true;
  if (/^sem ressalva(?:s)? dominante(?:s)?$/.test(normalizedOutput)) return true;
  if (/\bsem ressalva(?:s)? dominante(?:s)?\b/.test(normalizedOutput)) {
    const withoutFallbackMarker = normalizedOutput.replace(/\bsem ressalva(?:s)? dominante(?:s)?\b/g, "").trim();
    if (!withoutFallbackMarker || withoutFallbackMarker.length < 24) return true;
  }
  if (/\bme diga o objetivo em uma frase\b/.test(normalizedOutput)) return true;
  if (/\beu te ajudo melhor se voce me disser o objetivo em uma frase\b/.test(normalizedOutput)) return true;
  if (/\breferencias?\b/.test(normalizedOutput) && /\b(internal|memory):\/\//.test(normalizedOutput)) return true;
  if (/\b(resposta|answer)\s*:\s*(hipotese|contexto|evidencia|conclusao)\b/.test(normalizedOutput)) return true;

  if (isVerifiableQuestionForAutoSearch(prompt)) {
    const hasVerificationSignal =
      /\b(fontes?|source|sources|https?:\/\/|nao consegui validar|preciso verificar|incerteza|nao foi possivel confirmar)\b/.test(
        normalizedOutput,
      );
    if (normalizedOutput.length < 42 && !hasVerificationSignal) return true;
  }
  return false;
}

function buildDescendingQualityRepairPrompt(prompt: string): string {
  const trimmed = `${prompt || ""}`.trim();
  if (!trimmed) return "";
  const repairInstructions = [
    "Ajuste interno de qualidade da resposta:",
    "- responda somente ao pedido atual do usuario, sem metadados ou telemetria;",
    "- nao exponha scores, parametros, rotulos internos, JSON ou placeholders;",
    "- use texto natural, objetivo e coerente com o contexto da conversa;",
    "- se faltar dado essencial, faca uma pergunta curta de esclarecimento.",
  ].join("\n");
  return `${trimmed}\n\n${repairInstructions}`;
}

function toAnmTextResponse(anm: AnmChatResult, policyContext: ResponsePolicyContext) {
  const cleaned = stripConversationRoleArtifacts(anm.answer);
  const enforcedAnswer = enforceResponseStructure(cleaned || anm.answer, {
    state: policyContext.state,
    complexity: policyContext.complexity,
  });
  const headers: Record<string, string> = { "Content-Type": "text/plain; charset=utf-8" };
  if (anm.traceId) headers["X-KnexAI-Trace-Id"] = anm.traceId;
  return new Response(createChunkedTextStream(enforcedAnswer || cleaned || anm.answer), {
    status: 200,
    headers,
  });
}

function normalizeHistory(value: unknown): ChatHistoryItem[] {
  if (!Array.isArray(value)) return [];
  const items: ChatHistoryItem[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") continue;
    const role = (candidate as { role?: unknown }).role;
    const content = (candidate as { content?: unknown }).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;
    const trimmed = content.trim();
    if (!trimmed) continue;
    items.push({ role, content: trimmed });
  }
  // Mantem uma janela maior para preservar continuidade semantica entre turnos.
  return items.slice(-24);
}

function toDescendingRecentTurns(history: ChatHistoryItem[]) {
  return history.slice(-12).map((item) => ({ role: item.role, content: item.content }));
}

function filterHistoryForVerifiable(history: ChatHistoryItem[]) {
  if (!history.length) return [];
  const keepAssistantCited =
    parseOptionalBoolean(process.env.KNEXAI_KEEP_ASSISTANT_HISTORY_FOR_VERIFIABLE) !== false;
  const kept: ChatHistoryItem[] = [];
  for (const item of history.slice(-24)) {
    if (item.role === "user") {
      kept.push(item);
      continue;
    }
    if (!keepAssistantCited) continue;
    if (/(?:fontes?:|sources?:|fuentes?:|\[WEB_VERIFIED_CONTEXT\]|titular atual verificado|verified current office holder)/i.test(item.content)) {
      kept.push(item);
    }
  }
  return kept.slice(-10);
}

function parseOptionalBooleanFromBody(value: unknown) {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return undefined;
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return undefined;
}

function buildAnonymousConversationKey(prefix = "knexai:anon") {
  try {
    return `${prefix}:${crypto.randomUUID()}`;
  } catch {
    return `${prefix}:${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  }
}

function parseOptionalFiniteNumberFromBody(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalPositiveIntFromBody(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  const rounded = Math.round(parsed);
  return rounded > 0 ? rounded : undefined;
}

function parseOptionalPositiveIntArrayFromBody(value: unknown, maxItems = 64) {
  if (!Array.isArray(value)) return undefined;
  const normalized: number[] = [];
  const seen = new Set<number>();
  for (const raw of value) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) continue;
    const rounded = Math.round(parsed);
    if (rounded <= 0 || seen.has(rounded)) continue;
    seen.add(rounded);
    normalized.push(rounded);
    if (normalized.length >= maxItems) break;
  }
  return normalized.length ? normalized : undefined;
}

function parseStreamModeFromBody(value: unknown): "" | "sse" | "plain" {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toLowerCase();
  if (normalized === "sse" || normalized === "plain") return normalized;
  return "";
}

function parsePipelineVersionFromBody(value: unknown): "v1" | "v2" | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "v1" || normalized === "v2") return normalized;
  return undefined;
}

function parseOptionalEngineModeFromBody(value: unknown): EngineMode | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "direct") return "direct";
  // Compat legado: payloads antigos podem enviar "anm", mas o runtime atual e direct-only.
  if (normalized === "anm") return "direct";
  return undefined;
}

function parseOptionalLanguageIdFromBody(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, 32);
}

function buildAttachmentsFromComposer(
  composerAttachmentIds: number[] | undefined,
  scopedDocumentIds: number[] | undefined,
) {
  const ids = (composerAttachmentIds && composerAttachmentIds.length ? composerAttachmentIds : scopedDocumentIds) || [];
  return ids.map((id) => ({ id: `${id}`, kind: "file" as const, name: `documento-${id}` }));
}

function normalizeRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function sanitizeHistoryForModel(history: ChatHistoryItem[]): ChatHistoryItem[] {
  const sanitized: ChatHistoryItem[] = [];
  for (const item of history) {
    const content = item.content.trim();
    if (!content) continue;

    // Alguns templates exigem que o historico comecem por "user".
    if (!sanitized.length && item.role === "assistant") continue;

    const last = sanitized[sanitized.length - 1];
    if (!last) {
      sanitized.push({ role: item.role, content });
      continue;
    }

    // Consolida papeis repetidos para manter alternancia user/assistant.
    if (last.role === item.role) {
      last.content = `${last.content}\n${content}`.trim();
      continue;
    }

    sanitized.push({ role: item.role, content });
  }

  return sanitized;
}

function ensurePrompt(history: ChatHistoryItem[], prompt: string): ChatHistoryItem[] {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) return history;
  const last = history[history.length - 1];
  if (last?.role === "user" && last.content === trimmedPrompt) return history;
  return [...history, { role: "user", content: trimmedPrompt }];
}

function resolveEffectiveHistory(history: ChatHistoryItem[], prompt: string): ChatHistoryItem[] {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) return history;

  // Saudacoes/encerramentos devem ser tratados como turno atual isolado para evitar deriva para tema antigo.
  if (isMicroSocialPrompt(trimmedPrompt)) {
    return [{ role: "user", content: trimmedPrompt }];
  }

  return history;
}

function truncateHistoryContent(content: string, maxChars: number) {
  const normalized = content.trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, Math.max(32, maxChars - 3)).trimEnd()}...`;
}

function optimizeHistoryForLatency(history: ChatHistoryItem[], prompt: string): ChatHistoryItem[] {
  if (!history.length) return history;
  const complexity = classifyPromptComplexity(prompt);
  const last = history[history.length - 1];
  if (!last) return history;

  if (complexity === "micro") {
    return [{ role: "user", content: truncateHistoryContent(last.content, 320) }];
  }

  const limitsByComplexity: Record<PromptComplexity, { maxItems: number; charBudget: number; maxPerMessage: number; maxLast: number }> = {
    micro: { maxItems: 1, charBudget: 0, maxPerMessage: 320, maxLast: 320 },
    direct: { maxItems: 5, charBudget: 1400, maxPerMessage: 550, maxLast: 700 },
    short: { maxItems: 8, charBudget: 2400, maxPerMessage: 760, maxLast: 900 },
    medium: { maxItems: 10, charBudget: 3800, maxPerMessage: 1000, maxLast: 1200 },
    complex: { maxItems: 12, charBudget: 5600, maxPerMessage: 1400, maxLast: 1600 },
  };
  const limits = limitsByComplexity[complexity];
  const previous = history.slice(0, -1);
  const selectedReversed: ChatHistoryItem[] = [];
  let usedChars = 0;

  for (let idx = previous.length - 1; idx >= 0; idx -= 1) {
    if (selectedReversed.length >= Math.max(0, limits.maxItems - 1)) break;
    const item = previous[idx];
    const compact = truncateHistoryContent(item.content, limits.maxPerMessage);
    if (!compact) continue;
    if (usedChars + compact.length > limits.charBudget) break;
    usedChars += compact.length;
    selectedReversed.push({ role: item.role, content: compact });
  }

  selectedReversed.reverse();
  return [...selectedReversed, { role: last.role, content: truncateHistoryContent(last.content, limits.maxLast) }];
}

function isShortPrompt(prompt: string) {
  const normalized = prompt.trim();
  if (!normalized) return true;
  const words = normalized.split(/\s+/).filter(Boolean);
  return normalized.length <= 90 && words.length <= 16;
}

function isMicroSocialPrompt(prompt: string): boolean {
  const normalized = prompt.trim();
  if (!normalized) return false;

  const lowered = normalized.toLowerCase();
  const compact = lowered
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[!?.,;:"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = compact.split(" ").filter(Boolean);
  if (words.length > 8 || normalized.length > 60) return false;

  const microSocialPatterns = [
    /^(oi|ola|oie|oii|e ai|eae|opa|fala|salve|saudacoes|hey|hello|hi)(?: leticia)?$/i,
    /^(bom dia|boa tarde|boa noite|boa trde|boa tardee|boa tard)(?: leticia)?$/i,
    /^(blz|beleza|tudo bem(?: com (?:vc|voce|ce))?|td bem|tudo certo|tudo tranquilo|como vai|como vc (?:esta|ta)|como voce (?:esta|ta)|como ce (?:esta|ta)|how are you|que tal)(?: leticia)?$/i,
    /^(nada por agora|nada agora|de boa|tranquilo|ok|okay|ok obrigado|obrigado|obg|valeu)$/i,
    /^(ate logo|ate mais|tchau|falou|ate breve|bye)$/i,
  ];

  if (microSocialPatterns.some((pattern) => pattern.test(compact))) return true;

  // Tolerancia para typos simples em saudacoes curtas.
  const startsLikeGreeting =
    /^(oi+|ola+|opa|fala|salve|saudac|bom|boa)\b/.test(compact) ||
    /^(boa\s+trd|boa\s+tard|boa\s+trde)\b/.test(compact);
  const hasTaskSignal =
    /\b(api|sql|docker|codigo|c[oó]digo|presidente|capital|doenca|doen[cç]a|medicamento|tratamento|pesquisa|busque|buscar)\b/i.test(
      compact,
    );

  return startsLikeGreeting && words.length <= 3 && !hasTaskSignal;
}

function isBehaviorPersonalityPriorityPrompt(prompt: string): boolean {
  const normalized = `${prompt || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return false;
  if (isMicroSocialPrompt(normalized)) return true;

  const behaviorFamilies: RegExp[] = [
    /\b(meu nome|me chame|pode me chamar de|chame me de|chame-me de)\b/,
    /\b(qual(?: (?:e|eh))? (?:o )?(seu|teu) nome|me diga (?:o )?seu nome|me diz (?:o )?seu nome|diga (?:o )?seu nome)\b/,
    /\b(como (voce|vc|ce) se chama|quem (e|eh) (voce|vc|ce)|voce (e|eh) a leticia|vc (e|eh) a leticia|e o seu)\b/,
    /\b((por que|porque|pq) (voce|vc|ce) (tem|usa) (esse )?nome|qual a origem do seu nome|de onde vem o nome leticia|de onde surgiu o nome leticia|(?:por que|porque|pq) te chamam assim|te chamam assim)\b/,
    /\b(o que significa leticia|qual o significado( do nome)?( de)? leticia|leticia significa o que|o que quer dizer leticia|qual o sentido do nome leticia)\b/,
    /\b(qual o conceito de leticia|conceito de leticia|qual a definicao de leticia|definicao de leticia|base conceitual do nome leticia|qual a ideia por tras do nome leticia|como surgiu o nome leticia)\b/,
    /\b(quem (e|eh) (o )?medeiros|quem (e|eh) esse medeiros|quem te criou|quem criou voce|quem e seu criador|quem idealizou voce|quem desenvolveu voce)\b/,
    /\b(mais detalhes sobre ele|fale mais dele|pode me falar mais dele|mais sobre medeiros)\b/,
  ];
  return behaviorFamilies.some((pattern) => pattern.test(normalized));
}

function normalizeIdentityIntentHistoryWindow(history: ChatHistoryItem[], maxItems = 6) {
  if (!Array.isArray(history) || !history.length) return "";
  return history
    .slice(-maxItems)
    .map((row) => `${row?.content || ""}`.trim())
    .filter(Boolean)
    .map((row) => normalizeForVerification(row))
    .join(" ");
}

function hasAssistantIdentityContext(history: ChatHistoryItem[]) {
  const normalized = normalizeIdentityIntentHistoryWindow(history);
  if (!normalized) return false;
  return (
    /\b(eu sou a leticia|meu nome e leticia)\b/.test(normalized) ||
    /\b(qual\s+(?:(?:e|eh|o)\s+)?(?:o\s+)?seu nome|como voce se chama|quem e voce)\b/.test(normalized) ||
    /\b(o que significa leticia|por que voce tem esse nome|de onde vem o nome leticia|de onde surgiu o nome leticia|conceito de leticia|definicao de leticia|base conceitual do nome leticia|como surgiu o nome leticia|ideia por tras do nome leticia)\b/.test(
      normalized,
    ) ||
    /\b(quem e medeiros|quem e o medeiros|quem e esse medeiros)\b/.test(normalized)
  );
}

function hasCompetingTopicShift(normalized: string) {
  if (!normalized) return false;
  return /\b(capital|presidente|governador|prefeito|colesterol|diabetes|sintoma|tratamento|docker|kubernetes|sql|api|codigo|ciencia|historia|geografia)\b/.test(
    normalized,
  );
}

function classifyAssistantIdentityIntentFamily(
  prompt: string,
  history: ChatHistoryItem[],
): AssistantIdentityIntentFamily {
  const identityFallback = resolveIdentityFallbackForMessage(prompt);
  if (identityFallback.shouldHandle) {
    if (
      identityFallback.creatorQuestionDetected ||
      identityFallback.founderInfluenceQuestionDetected ||
      identityFallback.formationQuestionDetected ||
      identityFallback.professionalQuestionDetected
    ) {
      return "creator_identity";
    }
    if (identityFallback.nameOriginQuestionDetected) return "name_semantics";
    if (identityFallback.identityQuestionDetected) return "identity";
  }

  const normalized = normalizeForVerification(prompt);
  if (!normalized) return null;

  const hasIdentityContext = hasAssistantIdentityContext(history);
  const hasLeticia = /\bleticia\b/.test(normalized);
  const hasMedeiros = /\bmedeiros\b/.test(normalized);
  const hasTopicShift = hasCompetingTopicShift(normalized);
  const hasFollowUpReference = /\b(esse nome|esse significado|isso sobre o nome|isso do nome|isso|disso|isso ai|disso ai)\b/.test(normalized);
  const hasNameOriginByCalling = /\b((por que|porque|pq)\s+te\s+chamam\s+assim|te\s+chamam\s+assim)\b/.test(normalized);
  const hasCreatorFollowUpCue = /\b(mais\s+informacoes|mais\s+detalhes|fale\s+mais|me\s+diga\s+mais|me\s+conte\s+mais|quero\s+saber\s+mais|sobre\s+ele|sobre\s+esse|desse\s+medeiros|desse\s+mesmo|pode\s+me\s+falar\s+mais\s+dele|falar\s+mais\s+dele|mais\s+dele|voce\s+tem\s+certeza|vc\s+tem\s+certeza|tem\s+certeza|isso\s+esta\s+certo|isso\s+esta\s+correto|confirma\s+isso|confirmar\s+isso)\b/.test(
    normalized,
  );
  const hasDirectIdentityCue =
    hasLeticia ||
    hasNameOriginByCalling ||
    /\b(seu nome|como voce se chama|quem e voce|quem eh voce|nome leticia|medeiros)\b/.test(normalized);
  const directedToAssistant =
    hasDirectIdentityCue ||
    /\b(voce|vc|seu|sua|teu|tua)\b/.test(normalized) ||
    /\b(quem (?:e|eh) (?:voce|vc)|e o seu|e qual (?:e|eh)? o seu)\b/.test(normalized) ||
    (hasIdentityContext && hasFollowUpReference);
  const directedToUserSelf = /\b(meu|minha)\s+nome\b/.test(normalized);
  if (!directedToAssistant && directedToUserSelf) return null;
  if (hasTopicShift && !hasLeticia && !hasMedeiros && !hasNameOriginByCalling) return null;

  const asksSemantics = /\b(significa|significado|quer dizer|sentido|representa|origem|de onde vem|por que|porque|pq|motivo|razao)\b/.test(
    normalized,
  );
  const asksConceptDefinition = /\b(conceito|definicao|base conceitual|de onde surgiu|surgiu de onde|historia do nome|ideia por tras)\b/.test(normalized);
  const asksCreatorIdentity = /\b(quem (?:e|eh)\s+(?:o\s+)?medeiros|e quem (?:e|eh)\s+medeiros|quem (?:e|eh)\s+esse\s+medeiros)\b/.test(
    normalized,
  );
  const asksCreatorExpansion = hasMedeiros && hasCreatorFollowUpCue;
  const mentionsName = /\b(nome|chama|chamar|chamam|te chamam|identidade|esse nome|leticia)\b/.test(normalized);

  if (
    (asksCreatorIdentity || asksCreatorExpansion) &&
    (hasIdentityContext || hasDirectIdentityCue || hasFollowUpReference || /^e quem (?:e|eh)\s+medeiros\b/.test(normalized))
  ) {
    return "creator_identity";
  }
  if (hasIdentityContext && hasCreatorFollowUpCue && !hasTopicShift) {
    return "creator_identity";
  }
  if (
    directedToAssistant &&
    (asksSemantics || asksConceptDefinition) &&
    (mentionsName || hasLeticia || hasNameOriginByCalling || (hasIdentityContext && hasFollowUpReference))
  ) {
    return "name_semantics";
  }
  if (
    directedToAssistant &&
    (mentionsName || /\b(quem (?:e|eh) (?:voce|vc)|e o seu|e qual (?:e|eh)? o seu)\b/.test(normalized))
  ) {
    return "identity";
  }
  return null;
}

function buildAssistantIdentityFamilyReply(family: AssistantIdentityIntentFamily, prompt: string) {
  const resolved = resolveIdentityFallbackForMessage(prompt);
  if (!resolved.shouldHandle) return "";

  if (family === "identity" && resolved.identityQuestionDetected) {
    return resolved.shortNarrative;
  }

  if (family === "name_semantics" && resolved.nameOriginQuestionDetected) {
    return resolved.shortNarrative;
  }

  if (
    family === "creator_identity" &&
    (resolved.creatorQuestionDetected ||
      resolved.founderInfluenceQuestionDetected ||
      resolved.formationQuestionDetected ||
      resolved.professionalQuestionDetected)
  ) {
    return resolved.shortNarrative;
  }

  return resolved.shortNarrative || resolved.longNarrative || "";
}

function isSemanticRoutePriorityPrompt(prompt: string): boolean {
  const normalized = `${prompt || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return false;

  const semanticFamilies: RegExp[] = [
    /\b(refine|refinar|aprofundar|explorar|elaborar|desenvolver|co construir|co-construir|debater)\b/,
    /\b(evidencia|evidencias|fonte|fontes|lastro|fato|hipotese|especulacao|incerteza|validar|validacao)\b/,
    /\b(quem e voce|quem e vc|origem|criador|autoria|existencia|consciencia|limites ontologicos|quem sou eu|quem e leticia)\b/,
    /\b(analise|analisar|analitico|analitica|analise critica|resenha|resenha critica|dissertacao|dissertacao de|dissertação|dissertação de)\b/,
    /\b(busque|buscar|pesquise|pesquisar|procure|procurar|encontre|encontrar|search)\b.*\b(internet|web|online|site|sites|fontes|fonte)\b/,
  ];

  return semanticFamilies.some((pattern) => pattern.test(normalized));
}

function classifyPromptComplexity(prompt: string): PromptComplexity {
  const normalized = prompt.trim();
  if (!normalized) return "short";
  if (isMicroSocialPrompt(normalized)) return "micro";

  const lowered = normalized.toLowerCase();
  const loweredAscii = lowered
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  const words = normalized.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const charCount = normalized.length;

  const directIntentPatterns = [
    /\b(sinonimo|sinonimos|antonimo|antonimos)\b/i,
    /\b(traduz|traduza|traducao|translation)\b/i,
    /\b(defina|definicao|o que significa|significa)\b/i,
    /\b(corrija|correcao|ortografia|gramatica)\b/i,
    /\b(responda em uma frase|responda curto|resuma em uma frase|bem curto)\b/i,
  ];
  const directIntent = directIntentPatterns.some((pattern) => pattern.test(loweredAscii));
  if (directIntent && wordCount <= 24) return "direct";

  const complexSignals = [
    "explique em detalhes",
    "detalhe",
    "aprofunde",
    "analise",
    "compare",
    "passo a passo",
    "arquitetura",
    "estrategia",
    "plano",
    "trade-off",
    "vantagens e desvantagens",
    "como funciona",
    "por que",
    "porque",
  ];
  const hasComplexSignal = complexSignals.some((signal) => loweredAscii.includes(signal));
  if (hasComplexSignal || wordCount >= 45 || charCount >= 260) return "complex";

  if (wordCount <= 6 && !hasComplexSignal) return "direct";
  if (isShortPrompt(normalized)) return "short";
  return "medium";
}

function isStrictShortResponsePrompt(prompt: string) {
  const normalized = `${prompt || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return false;

  if (/\b(token de validacao|token de validacao exato|token exato)\b/.test(normalized)) return true;
  if (/\b(responda apenas|responda somente|apenas com|somente com)\b/.test(normalized)) return true;
  if (/\b(uma frase|1 frase|uma palavra|1 palavra|sim ou nao|so o nome|somente o nome)\b/.test(normalized)) return true;
  return false;
}

function resolveAutoScopedRagMaxResponseTokens(input: {
  prompt: string;
  hasDocumentScope: boolean;
  requestedMaxResponseTokens?: number;
}) {
  if (typeof input.requestedMaxResponseTokens === "number" && input.requestedMaxResponseTokens > 0) {
    return input.requestedMaxResponseTokens;
  }
  if (!input.hasDocumentScope) return input.requestedMaxResponseTokens;
  if (!isStrictShortResponsePrompt(input.prompt)) return input.requestedMaxResponseTokens;

  const complexity = classifyPromptComplexity(input.prompt);
  if (complexity === "micro") return 80;
  if (complexity === "direct") return 128;
  if (complexity === "short") return 192;
  return 256;
}

function resolveGenerationProfile(prompt: string, config: LlmConfig): GenerationProfile {
  const complexity = classifyPromptComplexity(prompt);

  if (complexity === "micro") {
    return {
      temperature: 0.08,
      topP: 0.72,
      maxTokens: Math.min(config.maxTokens, 40),
      repetitionPenalty: 1.2,
      brevityInstruction:
        "Interacao social breve: responda em 1 frase curta e cordial (ate 16 palavras), com acolhimento natural e sem rigidez.",
    };
  }

  if (complexity === "direct") {
    return {
      temperature: 0.12,
      topP: 0.8,
      maxTokens: Math.min(config.maxTokens, 256),
      repetitionPenalty: 1.12,
      brevityInstruction:
        "Resposta objetiva e pontual: va direto ao ponto em 1 paragrafo curto ou ate 2 frases encadeadas, sem fragmentacao.",
    };
  }

  if (complexity === "short") {
    return {
      temperature: 0.2,
      topP: 0.85,
      maxTokens: Math.min(config.maxTokens, 768),
      repetitionPenalty: 1.16,
      brevityInstruction:
        "Resposta curta e direta: use 1 paragrafo fluido (ate 4 frases), sem listas quebradas e sem repeticao desnecessaria.",
    };
  }

  if (complexity === "medium") {
    return {
      temperature: 0.28,
      topP: 0.9,
      maxTokens: Math.min(config.maxTokens, 2048),
      repetitionPenalty: 1.1,
      brevityInstruction:
        "Resposta equilibrada: explique com clareza em 1 a 3 paragrafos coesos e densos, mantendo continuidade com o turno anterior.",
    };
  }

  return {
    temperature: 0.32,
    topP: 0.92,
    maxTokens: config.maxTokens,
    repetitionPenalty: 1.08,
    brevityInstruction:
      "Resposta aprofundada e estruturada: traga contexto, explicacao tecnica, trade-offs e conclusao em paragrafos articulados e sem fragmentacao.",
  };
}

function buildSystemInstruction(profile: GenerationProfile, conversationStateBlock = "") {
  const currentDate = buildCurrentDateContext();
  const lines = [
    LETICIA_SYSTEM_PROMPT.trim(),
    "",
    currentDate.line,
    "Para perguntas com termos relativos (hoje, amanha, ontem), use essa data de referencia.",
    "",
    "Regras criticas desta resposta:",
    "- Responda a intencao mais recente do usuario (pergunta, saudacao, ajuste ou comando).",
    "- Em perguntas sobre sua identidade (nome, 'e o seu?', 'quem e voce'), responda diretamente: 'Eu sou a Letícia'.",
    "- Nunca diga que seu nome e 'Assistente' ou 'Assistant'.",
    "- Mantenha comunicacao polida, educada e receptiva; evite frieza ou rispidez.",
    "- Trate a mensagem atual como continuacao preferencial do fluxo em andamento, salvo mudanca explicita de assunto.",
    "- Em saudacoes e turnos sociais curtos, nao force retorno ao assunto anterior.",
    "- Preserve tema principal, tarefa ativa e objeto textual em curso antes de responder.",
    "- Use historico recente para manter continuidade semantica e nao reiniciar o raciocinio sem necessidade.",
    "- Nao invente fatos, termos tecnicos, ingredientes, nomes ou numeros.",
    "- Se houver incerteza factual, diga explicitamente que nao tem certeza.",
    "- Evite respostas picotadas: priorize paragrafos completos, articulados e com fechamento coerente.",
    "",
    `Diretriz de estilo: ${profile.brevityInstruction}`,
  ];
  if (conversationStateBlock.trim()) {
    lines.push("");
    lines.push("Estado conversacional consolidado:");
    lines.push(conversationStateBlock.trim());
  }
  return lines.join("\n");
}

function resolveMicroSocialLocale(prompt: string): SupportedLocale {
  const lowered = prompt.toLowerCase();
  if (/\b(hello|hi|hey|thanks|thank you|bye)\b/i.test(lowered)) return "en-US";
  if (/\b(hola|gracias|adios)\b/i.test(lowered)) return "es-ES";
  return "pt-BR";
}

function buildMicroSocialAnswer(prompt: string) {
  const compact = prompt
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[!?.,;:"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const locale = resolveMicroSocialLocale(prompt);

  if (/^saudacoes$/.test(compact)) {
    if (locale === "en-US") return "Greetings. How can I help you right now?";
    if (locale === "es-ES") return "Saludos. Como puedo ayudarte ahora?";
    return "Saudações. Como posso te ajudar agora?";
  }

  if (
    /^(?:(?:oi|ola|opa|fala|salve|saudacoes)\s+)?(como vc (?:esta|ta)|como voce (?:esta|ta)|como ce (?:esta|ta)|como vai|how are you|tudo bem(?: com (?:vc|voce|ce))?|td bem|tudo certo|tudo tranquilo|que tal)$/.test(
      compact,
    )
  ) {
    if (locale === "en-US") return "I am doing well and ready to help. What do you want to do next?";
    if (locale === "es-ES") return "Estoy bien y lista para ayudar. Que quieres hacer ahora?";
    return "Estou bem e pronta para ajudar. O que você quer fazer agora?";
  }

  if (/^(tchau|falou|ate mais|ate logo|bye|adios)$/.test(compact)) {
    if (locale === "en-US") return "See you! If you need anything else, I am here.";
    if (locale === "es-ES") return "Hasta luego. Si necesitas algo mas, aqui estoy.";
    return "Até mais. Se precisar de algo, estou aqui.";
  }
  if (/^(obrigado|obg|valeu|thanks|thank you|gracias)$/.test(compact)) {
    if (locale === "en-US") return "You are welcome. I am ready for the next step.";
    if (locale === "es-ES") return "De nada. Estoy lista para el siguiente paso.";
    return "De nada. Estou pronta para o próximo passo.";
  }
  if (locale === "en-US") return "Hi. How can I help you right now?";
  if (locale === "es-ES") return "Hola. Como puedo ayudarte ahora?";
  return "Oi. Como posso te ajudar agora?";
}

function shouldUseSystemRoleForChatCompletions() {
  const raw = pickFirstNonEmpty(process.env.KNEXAI_CHAT_USE_SYSTEM_ROLE, "1").toLowerCase();
  if (["0", "false", "no", "off"].includes(raw)) return false;
  return true;
}

function buildChatMessages(
  history: ChatHistoryItem[],
  profile: GenerationProfile,
  conversationStateBlock = "",
): ModelChatMessage[] {
  if (!history.length) return [];
  if (shouldUseSystemRoleForChatCompletions()) {
    return [{ role: "system", content: buildSystemInstruction(profile, conversationStateBlock) }, ...history];
  }

  const injected = history.map((item) => ({ ...item }));
  const firstUserIndex = injected.findIndex((row) => row.role === "user");
  if (firstUserIndex >= 0) {
    const firstUser = injected[firstUserIndex];
    firstUser.content = `${buildSystemInstruction(profile, conversationStateBlock)}\n\nPergunta atual:\n${firstUser.content}`.trim();
  }
  return injected;
}

function buildCompletionPrompt(history: ChatHistoryItem[], profile: GenerationProfile, conversationStateBlock = "") {
  const currentDate = buildCurrentDateContext();
  const lines = [LETICIA_SYSTEM_PROMPT.trim()];
  lines.push(currentDate.line);
  lines.push("Para perguntas com termos relativos (hoje, amanha, ontem), use essa data de referencia.");
  lines.push(
    "Regras criticas: responda a pergunta atual com continuidade contextual, preserve o objeto textual ativo e evite paragrafos fragmentados.",
  );
  lines.push(`Diretriz de estilo: ${profile.brevityInstruction}`);
  if (conversationStateBlock.trim()) {
    lines.push(`Estado conversacional consolidado:\n${conversationStateBlock.trim()}`);
  }
  history.forEach((item) => {
    const prefix = item.role === "assistant" ? "Letícia" : "Usuário";
    lines.push(`${prefix}: ${item.content}`);
  });
  lines.push("Letícia:");
  return lines.join("\n\n");
}

async function callLlm(url: string, payload: Record<string, unknown>, config: LlmConfig) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new LlmRouteError(504, "LLM_TIMEOUT", "Tempo limite ao consultar o motor de IA.");
    }
    const maybeCause = typeof error === "object" && error && "cause" in error ? (error as { cause?: { code?: string } }).cause : null;
    const code = maybeCause?.code || "";
    const connectivityCodes = new Set(["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EHOSTUNREACH"]);
    const suffix = connectivityCodes.has(code) ? ` (${code})` : "";
    throw new LlmRouteError(
      503,
      "LLM_UNAVAILABLE",
      `Motor local indisponivel em ${config.baseUrl}. Verifique se o vLLM esta ativo e acessivel${suffix}.`,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

function resolveModelCandidates(config: LlmConfig, availableModels: string[]) {
  const configuredCandidates = Array.from(new Set([config.model, ...config.modelFallbacks].map((value) => value.trim()).filter(Boolean)));
  if (!availableModels.length) return configuredCandidates;

  const availableSet = new Set(availableModels);
  const configuredAvailable = configuredCandidates.filter((candidate) => availableSet.has(candidate));
  if (configuredAvailable.length > 0) {
    return Array.from(new Set([...configuredAvailable, ...configuredCandidates, ...availableModels]));
  }

  return Array.from(new Set([...availableModels, ...configuredCandidates]));
}

async function fetchAvailableModels(config: LlmConfig): Promise<string[]> {
  const now = Date.now();
  if (
    availableModelsCache &&
    availableModelsCache.baseUrl === config.baseUrl &&
    availableModelsCache.apiKey === config.apiKey &&
    availableModelsCache.expiresAt > now
  ) {
    return availableModelsCache.models;
  }

  const controller = new AbortController();
  const timeoutMs = Math.max(1_500, Math.min(6_000, Math.floor(config.timeoutMs / 6)));
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${config.baseUrl}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json().catch(() => null)) as
      | { data?: Array<{ id?: unknown }>; models?: Array<{ id?: unknown } | string> }
      | null;
    if (!payload) {
      return [];
    }

    const fromData = Array.isArray(payload.data)
      ? payload.data.map((entry) => (typeof entry?.id === "string" ? entry.id.trim() : "")).filter(Boolean)
      : [];
    const fromModels = Array.isArray(payload.models)
      ? payload.models
          .map((entry) => {
            if (typeof entry === "string") return entry.trim();
            if (entry && typeof entry === "object" && "id" in entry) {
              const candidate = (entry as { id?: unknown }).id;
              return typeof candidate === "string" ? candidate.trim() : "";
            }
            return "";
          })
          .filter(Boolean)
      : [];

    const models = Array.from(new Set([...fromData, ...fromModels]));
    availableModelsCache = {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      models,
      expiresAt: Date.now() + AVAILABLE_MODELS_CACHE_TTL_MS,
    };
    return models;
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

type ExtractedChunk = {
  mode: "delta" | "full";
  text: string;
};

function extractTextFromChunk(payload: unknown, options?: { streaming?: boolean }): ExtractedChunk {
  if (!payload || typeof payload !== "object") return { mode: "full", text: "" };
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices.length) return { mode: "full", text: "" };
  const first = choices[0] as { delta?: { content?: unknown }; message?: { content?: unknown }; text?: unknown };
  if (typeof first?.delta?.content === "string") return { mode: "delta", text: first.delta.content };
  if (typeof first?.message?.content === "string") return { mode: "full", text: first.message.content };
  if (typeof first?.text === "string") {
    // OpenAI-like /completions: em streaming, `choices[0].text` eh delta; sem stream, eh texto final.
    return { mode: options?.streaming ? "delta" : "full", text: first.text };
  }
  return { mode: "full", text: "" };
}

function resolveDeltaFromFullText(previous: string, incoming: string) {
  if (!incoming) return { delta: "", nextState: previous };
  if (!previous) return { delta: incoming, nextState: incoming };
  if (incoming === previous) return { delta: "", nextState: previous };

  if (incoming.startsWith(previous)) {
    return { delta: incoming.slice(previous.length), nextState: incoming };
  }

  if (previous.startsWith(incoming)) {
    return { delta: "", nextState: previous };
  }

  if (incoming.includes(previous)) {
    const idx = incoming.indexOf(previous);
    return { delta: incoming.slice(idx + previous.length), nextState: incoming };
  }

  if (previous.includes(incoming)) {
    return { delta: "", nextState: previous };
  }

  let overlap = 0;
  const maxOverlap = Math.min(previous.length, incoming.length);
  for (let size = maxOverlap; size > 0; size -= 1) {
    if (previous.slice(-size) === incoming.slice(0, size)) {
      overlap = size;
      break;
    }
  }

  return { delta: incoming.slice(overlap), nextState: incoming };
}

async function mapNonStreamingToText(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const payload = await response.json().catch(() => null);
    const text = extractTextFromChunk(payload, { streaming: false }).text;
    if (!text) {
      throw new LlmRouteError(502, "LLM_INVALID_RESPONSE", "Resposta invalida do motor de IA.");
    }
    return text;
  }
  const plain = await response.text();
  if (!plain.trim()) {
    throw new LlmRouteError(502, "LLM_EMPTY_RESPONSE", "Motor de IA retornou resposta vazia.");
  }
  return plain;
}

function createChunkedTextStream(text: string, chunkSize = 320) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      if (!text) {
        controller.close();
        return;
      }
      for (let index = 0; index < text.length; index += chunkSize) {
        controller.enqueue(encoder.encode(text.slice(index, index + chunkSize)));
      }
      controller.close();
    },
  });
}

function resolveAnmAnswer(payload: unknown): AnmChatResult {
  if (!payload || typeof payload !== "object") {
    throw new LlmRouteError(502, "ANM_INVALID_RESPONSE", "ANM retornou payload invalido.");
  }
  const candidate = payload as {
    answer?: unknown;
    text?: unknown;
    output?: unknown;
    trace_id?: unknown;
    traceId?: unknown;
  };
  const answerRaw =
    typeof candidate.answer === "string"
      ? candidate.answer
      : typeof candidate.text === "string"
        ? candidate.text
        : typeof candidate.output === "string"
          ? candidate.output
          : "";
  const answer = answerRaw.trim();
  if (!answer) {
    throw new LlmRouteError(502, "ANM_EMPTY_RESPONSE", "ANM nao retornou resposta textual.");
  }
  const traceCandidate = typeof candidate.trace_id === "string" ? candidate.trace_id : typeof candidate.traceId === "string" ? candidate.traceId : "";
  return { answer, traceId: traceCandidate || null };
}

async function requestAnmChat(
  config: EngineModeConfig,
  prompt: string,
  sharedIdentityRuntime?: Record<string, unknown> | null,
  options?: {
    mode?: "chat" | "proactive" | "voice" | "identity_aware";
    history?: ChatHistoryItem[];
    localeHint?: string;
    conversationKey?: string;
    userKey?: string;
  },
): Promise<AnmChatResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.anmTimeoutMs);
  try {
    const mode = options?.mode || "chat";
    const history = Array.isArray(options?.history) ? options.history.slice(-20) : [];
    const localeHint = (options?.localeHint || "").trim();
    const conversationKey = (options?.conversationKey || "").trim();
    const userKey = (options?.userKey || "").trim();

    const leticiaResponse = await fetch(`${config.anmBaseUrl}/assistant/leticia/respond`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: prompt,
        mode,
        history,
        locale_hint: localeHint || undefined,
        conversation_key: conversationKey || undefined,
        user_key: userKey || undefined,
        prompt,
        shared_identity_runtime: sharedIdentityRuntime || undefined,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (leticiaResponse.ok) {
      const payload = await leticiaResponse.json().catch(() => null);
      return resolveAnmAnswer(payload);
    }

    if (leticiaResponse.status !== 404) {
      const responseText = await leticiaResponse.text().catch(() => "");
      const detail = responseText.trim().slice(0, 240);
      throw new LlmRouteError(
        leticiaResponse.status >= 500 ? 503 : 502,
        "ANM_UPSTREAM_ERROR",
        `ANM respondeu com erro HTTP ${leticiaResponse.status}${detail ? ` (${detail})` : ""}.`,
      );
    }

    const fallbackResponse = await fetch(`${config.anmBaseUrl}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: prompt,
        shared_identity_runtime: sharedIdentityRuntime || undefined,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!fallbackResponse.ok) {
      const responseText = await fallbackResponse.text().catch(() => "");
      const detail = responseText.trim().slice(0, 240);
      throw new LlmRouteError(
        fallbackResponse.status >= 500 ? 503 : 502,
        "ANM_UPSTREAM_ERROR",
        `ANM respondeu com erro HTTP ${fallbackResponse.status}${detail ? ` (${detail})` : ""}.`,
      );
    }

    const payload = await fallbackResponse.json().catch(() => null);
    return resolveAnmAnswer(payload);
  } catch (error) {
    if (error instanceof LlmRouteError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new LlmRouteError(504, "ANM_TIMEOUT", "Tempo limite ao consultar o ANM backend.");
    }
    throw new LlmRouteError(503, "ANM_UNAVAILABLE", `ANM backend indisponivel em ${config.anmBaseUrl}.`);
  } finally {
    clearTimeout(timeoutId);
  }
}

function sseToPlainTextStream(response: Response) {
  if (!response.body) {
    throw new LlmRouteError(502, "LLM_EMPTY_STREAM", "Motor de IA nao retornou stream.");
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let emittedAny = false;
  let fullTextState = "";
  const mergeChunk = (chunk: ExtractedChunk) => {
    const incoming = chunk.text;
    if (!incoming) return "";

    // Modo delta: anexa diretamente e trata apenas casos claros de replay cumulativo.
    if (chunk.mode === "delta") {
      if (!fullTextState) {
        fullTextState = incoming;
        return incoming;
      }
      if (incoming === fullTextState) return "";
      if (incoming.startsWith(fullTextState)) {
        const delta = incoming.slice(fullTextState.length);
        fullTextState = incoming;
        return delta;
      }
      fullTextState += incoming;
      return incoming;
    }

    // Modo full/cumulativo: reconcilia com o estado previamente emitido.
    const { delta, nextState } = resolveDeltaFromFullText(fullTextState, incoming);
    fullTextState = nextState;
    return delta;
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = response.body!.getReader();
      let buffer = "";
      let closed = false;
      const processSseDataLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) return;
        const data = trimmed.slice(5).trim();
        if (!data) return;
        if (data === "[DONE]") {
          safeClose();
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const extracted = extractTextFromChunk(parsed, { streaming: true });
          const delta = mergeChunk(extracted);
          if (!delta) return;
          emittedAny = true;
          controller.enqueue(encoder.encode(delta));
        } catch {
          // Ignore malformed JSON chunks and continue stream parsing.
        }
      };
      const safeClose = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || "";
          for (const line of lines) processSseDataLine(line);
        }

        // Flush final decoder state and parse any trailing SSE line without newline terminator.
        buffer += decoder.decode();
        if (buffer.trim()) {
          const trailingLines = buffer.split(/\r?\n/);
          for (const line of trailingLines) {
            processSseDataLine(line);
            if (closed) return;
          }
        }
      } catch (error) {
        console.error("KNEXAI_STREAM_ERROR", error);
      } finally {
        safeClose();
      }
    },
  });

  return { stream, emittedAny: () => emittedAny };
}

async function requestLlmStreaming(
  config: LlmConfig,
  history: ChatHistoryItem[],
  prompt: string,
  conversationStateBlock = "",
) {
  const chatUrl = `${config.baseUrl}/chat/completions`;
  const completionUrl = `${config.baseUrl}/completions`;
  const profile = resolveGenerationProfile(prompt, config);
  const tokenCandidates = Array.from(
    new Set(
      [profile.maxTokens, Math.floor(profile.maxTokens * 0.75), Math.floor(profile.maxTokens * 0.5), 512, 384, 256, 128]
        .map((value) => Math.max(64, value))
        .filter((value) => Number.isFinite(value)),
    ),
  );

  const isTokenLimitFailure = (status: number, body: string) => {
    if (![400, 413, 422].includes(status)) return false;
    const signal = `${body || ""}`.toLowerCase();
    return /(max.?tokens|max_model_len|context|too long|exceed|token)/i.test(signal);
  };
  const isModelNotFoundFailure = (status: number, body: string) => {
    if (status !== 404) return false;
    const signal = `${body || ""}`.toLowerCase();
    return /(model).*(does not exist|not found|unknown)/i.test(signal) || /notfounderror/i.test(signal);
  };

  const shouldFallbackToCompletions = (status: number) => [400, 404, 405, 422].includes(status);
  let tokenLimitDetected = false;
  const triedModels: string[] = [];
  const availableModels = await fetchAvailableModels(config);
  const modelCandidates = resolveModelCandidates(config, availableModels);

  if (availableModels.length > 0 && modelCandidates[0] !== config.model) {
    console.warn("KNEXAI_MODEL_REORDER", {
      requestedModel: config.model,
      selectedFirstModel: modelCandidates[0],
      availableModels,
    });
  }

  const requestWithModel = async (modelName: string): Promise<Response> => {
    let chatFailure: { status: number; body: string } | null = null;

    for (let index = 0; index < tokenCandidates.length; index += 1) {
      const maxTokens = tokenCandidates[index];
      const isLastCandidate = index === tokenCandidates.length - 1;
      const chatPayload = {
        model: modelName,
        messages: buildChatMessages(history, profile, conversationStateBlock),
        temperature: profile.temperature,
        top_p: profile.topP,
        repetition_penalty: profile.repetitionPenalty,
        max_tokens: maxTokens,
        stream: true,
      };

      const chatResponse = await callLlm(chatUrl, chatPayload, config);
      if (chatResponse.ok) return chatResponse;

      const body = await chatResponse.text().catch(() => "");
      chatFailure = { status: chatResponse.status, body };
      if (isModelNotFoundFailure(chatResponse.status, body)) {
        throw new LlmRouteError(404, "LLM_MODEL_NOT_FOUND", `Modelo '${modelName}' nao encontrado no motor local.`);
      }
      if (isTokenLimitFailure(chatResponse.status, body)) {
        tokenLimitDetected = true;
        console.warn("KNEXAI_CHAT_TOKEN_RETRY", {
          status: chatResponse.status,
          model: modelName,
          maxTokens,
          nextAttempt: !isLastCandidate,
        });
        if (!isLastCandidate) continue;
      }
      if (!shouldFallbackToCompletions(chatResponse.status)) {
        console.error("KNEXAI_CHAT_ERROR", {
          status: chatResponse.status,
          model: modelName,
          bodySnippet: body.slice(0, 300),
        });
        throw new LlmRouteError(502, "LLM_UPSTREAM_ERROR", `Motor de IA retornou erro upstream (status ${chatResponse.status}).`);
      }
      break;
    }

    if (chatFailure) {
      console.warn("KNEXAI_CHAT_FALLBACK", {
        status: chatFailure.status,
        model: modelName,
        bodySnippet: chatFailure.body.slice(0, 300),
      });
    }

    for (let index = 0; index < tokenCandidates.length; index += 1) {
      const maxTokens = tokenCandidates[index];
      const isLastCandidate = index === tokenCandidates.length - 1;
      const completionPayload = {
        model: modelName,
        prompt: buildCompletionPrompt(history, profile, conversationStateBlock),
        temperature: profile.temperature,
        top_p: profile.topP,
        repetition_penalty: profile.repetitionPenalty,
        max_tokens: maxTokens,
        stream: true,
      };

      const completionResponse = await callLlm(completionUrl, completionPayload, config);
      if (completionResponse.ok) return completionResponse;

      const completionErrorBody = await completionResponse.text().catch(() => "");
      if (isModelNotFoundFailure(completionResponse.status, completionErrorBody)) {
        throw new LlmRouteError(404, "LLM_MODEL_NOT_FOUND", `Modelo '${modelName}' nao encontrado no motor local.`);
      }
      if (isTokenLimitFailure(completionResponse.status, completionErrorBody)) {
        tokenLimitDetected = true;
        console.warn("KNEXAI_COMPLETION_TOKEN_RETRY", {
          status: completionResponse.status,
          model: modelName,
          maxTokens,
          nextAttempt: !isLastCandidate,
        });
        if (!isLastCandidate) continue;
      }

      console.error("KNEXAI_COMPLETION_ERROR", {
        status: completionResponse.status,
        model: modelName,
        bodySnippet: completionErrorBody.slice(0, 300),
      });
      throw new LlmRouteError(502, "LLM_UPSTREAM_ERROR", `Motor de IA retornou erro upstream (status ${completionResponse.status}).`);
    }

    throw new LlmRouteError(502, "LLM_UPSTREAM_ERROR", "Falha ao consultar o motor de IA.");
  };

  for (const modelName of modelCandidates) {
    triedModels.push(modelName);
    try {
      return await requestWithModel(modelName);
    } catch (error) {
      if (error instanceof LlmRouteError && error.code === "LLM_MODEL_NOT_FOUND") {
        console.warn("KNEXAI_MODEL_FALLBACK", {
          requestedModel: config.model,
          attemptedModel: modelName,
          nextModel: modelCandidates.find((candidate) => !triedModels.includes(candidate)) || null,
        });
        continue;
      }
      throw error;
    }
  }

  if (tokenLimitDetected) {
    throw new LlmRouteError(
      422,
      "LLM_CONTEXT_LIMIT",
      "Contexto muito longo para o modelo atual. Reduza o historico ou ajuste LLM_MAX_TOKENS.",
    );
  }

  throw new LlmRouteError(
    502,
    "LLM_MODEL_NOT_FOUND",
    `Modelo logico '${config.model}' nao foi encontrado no motor local. Modelos tentados: ${triedModels.join(", ")}. ` +
      "Ajuste LLM_MODEL_NAME ou suba o vLLM com --served-model-name mistral-awq.",
  );
}

async function toClientTextStreamResponse(
  upstream: Response,
  policyContext: ResponsePolicyContext,
): Promise<Response> {
  const contentType = upstream.headers.get("content-type") || "";
  let rawText = "";
  if (contentType.includes("text/event-stream")) {
    const { stream } = sseToPlainTextStream(upstream);
    rawText = await new Response(stream).text();
  } else {
    rawText = await mapNonStreamingToText(upstream);
  }
  const cleaned = stripConversationRoleArtifacts(rawText);
  const enforced = enforceResponseStructure(cleaned || rawText, {
    state: policyContext.state,
    complexity: policyContext.complexity,
  });
  return new Response(createChunkedTextStream(enforced || cleaned || rawText), {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET() {
  const config = readLlmConfig();
  const engineMode = readEngineModeConfig();
  const descendingPipeline = readDescendingPipelineConfig();
  const anmResolution =
    engineMode.mode === "anm"
      ? await resolveReachableAnmBaseUrl({
          configuredBaseUrl: engineMode.anmBaseUrl,
          timeoutMs: Math.min(2_000, engineMode.anmTimeoutMs),
          healthPath: "/healthz",
        })
      : null;

  return Response.json(
    {
      ok: true,
      endpoint: "/api/knexai",
      provider: engineMode.mode === "anm" ? "anm-api" : "openai-compatible",
      engineMode: engineMode.mode,
      anmBaseUrl: anmResolution?.baseUrl || engineMode.anmBaseUrl,
      anmConfiguredBaseUrl: engineMode.anmBaseUrl,
      anmAttemptedBaseUrls: anmResolution?.attemptedBaseUrls || [engineMode.anmBaseUrl],
      anmSoftTimeoutMs: engineMode.anmSoftTimeoutMs,
      anmFallbackToDirect: engineMode.fallbackToDirect,
      baseUrl: config.baseUrl,
      fallbackBaseUrls: config.fallbackBaseUrls,
      resolvedCandidates: resolveLlmBaseUrlCandidates(config),
      model: config.model,
      modelFallbacks: config.modelFallbacks,
      contextWindow: config.contextWindow,
      maxTokens: config.maxTokens,
      descendingPipeline,
    },
    { status: 200 },
  );
}

export async function POST(req: NextRequest) {
  const config = readLlmConfig();
  const engineMode = readEngineModeConfig();
  const descendingPipelineDefaults = readDescendingPipelineConfig();

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const prompt = body?.prompt ?? body?.message ?? body?.question;
    const history = body?.history;
    const safePrompt = typeof prompt === "string" ? prompt.trim() : "";
    if (!safePrompt) {
      return safeBackendError(400, "EMPTY_PROMPT", "Informe a mensagem atual em 'prompt' para enviar ao modelo.");
    }
    const pipelineVersion = parsePipelineVersionFromBody(body?.pipeline);
    const composerBound = parseOptionalBooleanFromBody(body?.composerBound);
    const composerAttachmentIds = parseOptionalPositiveIntArrayFromBody(body?.composerAttachmentIds);
    const topK = parseOptionalPositiveIntFromBody(body?.topK);
    const maxDistance = body?.maxDistance === null ? null : parseOptionalFiniteNumberFromBody(body?.maxDistance);
    const documentId = parseOptionalPositiveIntFromBody(body?.documentId);
    const documentIds = parseOptionalPositiveIntArrayFromBody(body?.documentIds);
    const sourceType = typeof body?.sourceType === "string" ? body.sourceType.trim() : "";
    const retrievalEmbeddingModel = typeof body?.retrievalEmbeddingModel === "string" ? body.retrievalEmbeddingModel.trim() : "";
    const preferredResponseLanguageId = parseOptionalLanguageIdFromBody(body?.preferredResponseLanguageId);
    const maxResponseTokens = parseOptionalPositiveIntFromBody(body?.maxResponseTokens);
    const temperature = parseOptionalFiniteNumberFromBody(body?.temperature);
    const seedRaw = body?.seed;
    const seed = seedRaw === null ? null : parseOptionalFiniteNumberFromBody(seedRaw);
    const anmEngineModeFromBody = parseOptionalEngineModeFromBody(body?.anmEngineMode ?? body?.engineMode);
    const anmBaseUrlFromBody = typeof body?.anmBaseUrl === "string" ? body.anmBaseUrl.trim() : "";
    const anmTimeoutMsFromBody = parseOptionalPositiveIntFromBody(body?.anmTimeoutMs);
    const anmSoftTimeoutMsFromBody = parseOptionalPositiveIntFromBody(body?.anmSoftTimeoutMs);
    const anmFallbackToDirectFromBody = parseOptionalBooleanFromBody(body?.anmFallbackToDirect);
    const streamRequested = parseOptionalBooleanFromBody(body?.stream) === true;
    const requestedStreamMode = parseStreamModeFromBody(body?.streamMode);
    const acceptHeader = `${req.headers.get("accept") || ""}`.toLowerCase();
    const streamMode = requestedStreamMode || (acceptHeader.includes("text/event-stream") ? "sse" : "plain");

    const normalizedHistory = normalizeHistory(history);
    const forceDescendingHint =
      parseOptionalBooleanFromBody(
        body?.forceDescendingPipeline ?? body?.alwaysUseDescendingPipeline ?? body?.forceDescending,
      ) === true;
    const disableMicroSocialFastPathFromBody =
      parseOptionalBooleanFromBody(body?.disableMicroSocialFastPath ?? body?.skipMicroSocialFastPath) === true;
    const llmBridgeAlwaysOn = parseOptionalBoolean(process.env.ANM_LLM_BRIDGE_ALWAYS_ON) !== false;
    const microSocialFastPathEnabled =
      parseOptionalBoolean(process.env.KNEXAI_MICRO_SOCIAL_FASTPATH_ENABLED) === true &&
      !llmBridgeAlwaysOn;
    const shouldUseMicroSocialFastPath =
      microSocialFastPathEnabled &&
      !disableMicroSocialFastPathFromBody &&
      !forceDescendingHint &&
      normalizedHistory.length === 0 &&
      isMicroSocialPrompt(safePrompt);

    if (shouldUseMicroSocialFastPath) {
      const microText = buildMicroSocialAnswer(safePrompt);
      const textStream = createChunkedTextStream(microText);
      const responseStream = streamRequested && streamMode === "sse" ? toSseStream(textStream) : textStream;
      return new Response(responseStream, {
        status: 200,
        headers: {
          "Content-Type":
            streamRequested && streamMode === "sse"
              ? "text/event-stream; charset=utf-8"
              : "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
          "X-KnexAI-Pipeline": "micro-fastpath",
        },
      });
    }
    const verificationTargetPrompt = resolveVerificationTargetPrompt(safePrompt, normalizedHistory);
    const identityIntentFamilyFromPrompt = classifyAssistantIdentityIntentFamily(safePrompt, normalizedHistory);
    const identityIntentFamilyFromVerificationTarget =
      verificationTargetPrompt && verificationTargetPrompt !== safePrompt
        ? classifyAssistantIdentityIntentFamily(verificationTargetPrompt, normalizedHistory)
        : null;
    const identityIntentFamily = identityIntentFamilyFromPrompt || identityIntentFamilyFromVerificationTarget;

    const hasDocumentScope =
      Boolean(documentId) ||
      Boolean(documentIds?.length) ||
      Boolean(composerAttachmentIds?.length) ||
      composerBound === true;
    const forceWebMultiSourceDefault = parseOptionalBoolean(process.env.KNEXAI_FORCE_MULTI_SOURCE_WEB_SEARCH) !== false;
    const forceWebMultiSourceFromBody = parseOptionalBooleanFromBody(
      body?.forceWebMultiSource ?? body?.forceWebVerification ?? body?.forceWebSearch,
    );
    const forceWebMultiSourceSetting =
      typeof forceWebMultiSourceFromBody === "boolean" ? forceWebMultiSourceFromBody : forceWebMultiSourceDefault;
    const forceRagForVerifiable = parseOptionalBoolean(process.env.KNEXAI_FORCE_RAG_FOR_VERIFIABLE) === true;
    const forceDirectForVerifiableDefault = parseOptionalBoolean(process.env.KNEXAI_FORCE_DIRECT_FOR_VERIFIABLE) === true;
    const forceDirectForVerifiableFromBody = parseOptionalBooleanFromBody(
      body?.forceDirectForVerifiable ?? body?.forceDirectVerificationEngine,
    );
    const forceDirectForVerifiable =
      typeof forceDirectForVerifiableFromBody === "boolean"
        ? forceDirectForVerifiableFromBody
        : forceDirectForVerifiableDefault;
    const requestedForceRag = parseOptionalBooleanFromBody(body?.forceRag) === true;
    const cascade = resolveVerificationCascadePlan({
      prompt: verificationTargetPrompt,
      hasDocumentScope,
      requestedForceRag,
      forceWebMultiSource: forceWebMultiSourceSetting,
      forceRagForVerifiable,
      forceDirectForVerifiable,
    });
    const forceWebMultiSource = cascade.forceWebMultiSource;
    const verifiableQuestion = cascade.verifiableQuestion;
    const forceRag = cascade.forceRag;
    const shouldForceFullRagMode = cascade.shouldForceFullRagMode;
    const shouldRequireWebBeforeRag = cascade.shouldRequireWebBeforeRag;
    const filteredHistoryForVerifiable: ChatHistoryItem[] =
      parseOptionalBoolean(process.env.KNEXAI_FILTER_ASSISTANT_HISTORY_FOR_VERIFIABLE) !== false
        ? filterHistoryForVerifiable(normalizedHistory)
        : normalizedHistory;
    const historyForCascade: ChatHistoryItem[] =
      forceWebMultiSource && verifiableQuestion && !hasDocumentScope ? filteredHistoryForVerifiable : normalizedHistory;
    const effectiveMaxResponseTokens = resolveAutoScopedRagMaxResponseTokens({
      prompt: safePrompt,
      hasDocumentScope,
      requestedMaxResponseTokens: maxResponseTokens,
    });
    logVerificationCascadeStage("classify", cascade, { hasDocumentScope, requestedForceRag });

    const localeHintFromBody =
      (typeof body?.localeHint === "string" && body.localeHint.trim()) ||
      (typeof body?.locale === "string" && body.locale.trim()) ||
      "";
    const explicitConversationKey =
      (typeof body?.conversationKey === "string" && body.conversationKey.trim()) ||
      (typeof body?.conversation_key === "string" && body.conversation_key.trim()) ||
      (typeof body?.sessionId === "string" && body.sessionId.trim()) ||
      (typeof body?.threadId === "string" && body.threadId.trim());
    const conversationKeyFromBody = explicitConversationKey || buildAnonymousConversationKey();
    const userKeyFromBody =
      (typeof body?.userKey === "string" && body.userKey.trim()) ||
      (typeof body?.user_key === "string" && body.user_key.trim()) ||
      conversationKeyFromBody;
    const descendingStrictFromBody = parseOptionalBooleanFromBody(
      body?.descendingPipelineStrict ?? body?.strictDescendingPipeline,
    );
    const descendingEnabledFromBody = parseOptionalBooleanFromBody(
      body?.descendingPipelineEnabled ?? body?.useDescendingPipeline ?? body?.forceDescendingPipeline,
    );
    const descendingForceFromBody = parseOptionalBooleanFromBody(
      body?.forceDescendingPipeline ?? body?.alwaysUseDescendingPipeline ?? body?.forceDescending,
    );
    const descendingDisableFromBody = parseOptionalBooleanFromBody(
      body?.disableDescendingPipeline ?? body?.skipDescendingPipeline,
    );
    const directFallbackFromBody = parseOptionalBooleanFromBody(
      body?.directFallbackEnabled ?? body?.allowDirectFallback,
    );
    const descendingQualityRetryCountFromBody = parseOptionalPositiveIntFromBody(
      body?.descendingQualityRetryCount ?? body?.descendingRetryCount,
    );
    const forceDescendingWithDocumentScopeFromBody = parseOptionalBooleanFromBody(
      body?.forceDescendingWithDocumentScope ?? body?.allowDescendingWithDocumentScope,
    );
    const descendingStrict =
      typeof descendingStrictFromBody === "boolean" ? descendingStrictFromBody : descendingPipelineDefaults.strict;
    const allowDirectFallbackAfterDescendingFailure =
      typeof directFallbackFromBody === "boolean"
        ? directFallbackFromBody
        : parseOptionalBoolean(process.env.KNEXAI_DESCENDING_ALLOW_DIRECT_FALLBACK) !== false;
    const descendingQualityRetryCount = (() => {
      const fromBody = typeof descendingQualityRetryCountFromBody === "number"
        ? descendingQualityRetryCountFromBody
        : null;
      if (fromBody !== null) return Math.max(0, Math.min(2, fromBody));
      const fromEnv = Number.parseInt(`${process.env.KNEXAI_DESCENDING_QUALITY_RETRY_COUNT || "1"}`, 10);
      if (Number.isFinite(fromEnv)) return Math.max(0, Math.min(2, fromEnv));
      return 1;
    })();
    let forceDirectAfterDescendingFailure = false;
    const descendingEnabled =
      typeof descendingEnabledFromBody === "boolean" ? descendingEnabledFromBody : descendingPipelineDefaults.enabled;
    const descendingForce = descendingForceFromBody === true;
    const bypassDescendingWithDocumentScope =
      typeof forceDescendingWithDocumentScopeFromBody === "boolean"
        ? !forceDescendingWithDocumentScopeFromBody
        : parseOptionalBoolean(process.env.KNEXAI_DESCENDING_BYPASS_FOR_DOCUMENT_SCOPE) !== false;
    const shouldBypassDescendingForDocumentScope = hasDocumentScope && bypassDescendingWithDocumentScope;
    const behaviorPersonalityPriorityPrompt =
      isBehaviorPersonalityPriorityPrompt(safePrompt) || isBehaviorPersonalityPriorityPrompt(verificationTargetPrompt);
    const semanticRoutePriorityPrompt =
      isSemanticRoutePriorityPrompt(safePrompt) || isSemanticRoutePriorityPrompt(verificationTargetPrompt);
    const identityPriorityPrompt = identityIntentFamily !== null;
    const shouldForceDescendingForIdentity = llmBridgeAlwaysOn && identityPriorityPrompt;
    const shouldRunDescending =
      descendingDisableFromBody === true
        ? false
        : shouldForceDescendingForIdentity
        ? true
        : descendingEnabled &&
          (descendingForce
            ? true
            : descendingPipelineDefaults.onlyVerifiable
            ? (verifiableQuestion || behaviorPersonalityPriorityPrompt || semanticRoutePriorityPrompt || identityPriorityPrompt)
            : true) &&
          (descendingPipelineDefaults.allowVerifiable || !verifiableQuestion) &&
          !shouldBypassDescendingForDocumentScope;

    if (shouldRunDescending) {
        const descendingInput = {
          rawMessage: safePrompt,
          sessionId: conversationKeyFromBody,
          turnId:
            (typeof body?.requestId === "string" && body.requestId.trim()) ||
            `turn-${Date.now()}`,
          recentTurns: toDescendingRecentTurns(historyForCascade),
        };

      try {
        const maxAttempts = Math.max(1, descendingQualityRetryCount + 1);
        let selectedRun: Awaited<ReturnType<typeof runPipelineRootBridge>> | null = null;
        let selectedOutputText = "";
        let selectedAttempt = 1;
        let lastDescendingError: Error | null = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          const isRepairAttempt = attempt > 1;
          const attemptInput = isRepairAttempt
            ? {
                ...descendingInput,
                rawMessage: buildDescendingQualityRepairPrompt(safePrompt),
                turnId: `${descendingInput.turnId}-q${attempt}`,
              }
            : descendingInput;

          try {
            const run = await runPipelineRootBridge(attemptInput);
            const sanitized = stripConversationRoleArtifacts(run.responseText || "");
            const outputText = sanitized || run.responseText || "";
            if (!outputText) {
              lastDescendingError = new Error("empty_descending_pipeline_output");
              continue;
            }
            if (isLowQualityDescendingOutput(outputText, verificationTargetPrompt)) {
              lastDescendingError = new Error("low_quality_descending_pipeline_output");
              continue;
            }
            selectedRun = run;
            selectedOutputText = outputText;
            selectedAttempt = attempt;
            break;
          } catch (attemptError) {
            lastDescendingError = attemptError instanceof Error
              ? attemptError
              : new Error(String(attemptError));
            if (attempt >= maxAttempts) {
              throw lastDescendingError;
            }
          }
        }

        if (!selectedRun || !selectedOutputText) {
          throw lastDescendingError || new Error("descending_pipeline_attempts_exhausted");
        }
        const finalDescendingText = selectedOutputText
          .replace(/^\s*resposta\s*:\s*\n+/i, "")
          .replace(/^\s*resposta\s*:\s*/i, "")
          .trim();

        console.info("KNEXAI_DESCENDING_PIPELINE_OK", {
          route: selectedRun.route,
          traceEvents: selectedRun.state.trace.length,
          confidenceFinal: selectedRun.state.confidenceScores.final,
          strict: descendingStrict,
          usedAsFinalResponse: true,
          attempt: selectedAttempt,
          maxAttempts,
        });

        if (streamRequested) {
          const textStream = createChunkedTextStream(finalDescendingText || selectedOutputText);
          const responseStream = streamMode === "sse" ? toSseStream(textStream) : textStream;
          return new Response(responseStream, {
            status: 200,
            headers: {
              "Content-Type": streamMode === "sse" ? "text/event-stream; charset=utf-8" : "text/plain; charset=utf-8",
              "Cache-Control": "no-cache, no-transform",
              Connection: "keep-alive",
              "X-Accel-Buffering": "no",
              "X-KnexAI-Pipeline": "descending",
              "X-KnexAI-Route": selectedRun.route,
              "X-KnexAI-Descending-Attempt": `${selectedAttempt}/${maxAttempts}`,
            },
          });
        }

        return new Response(createChunkedTextStream(finalDescendingText || selectedOutputText), {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-KnexAI-Pipeline": "descending",
            "X-KnexAI-Route": selectedRun.route,
            "X-KnexAI-Descending-Attempt": `${selectedAttempt}/${maxAttempts}`,
          },
        });
      } catch (error) {
        console.warn("KNEXAI_DESCENDING_PIPELINE_FAILED", {
          message: error instanceof Error ? error.message : String(error),
          strict: descendingStrict,
          allowDirectFallbackAfterDescendingFailure,
          retryBudget: descendingQualityRetryCount,
          identityIntentFamily,
        });
        if (identityIntentFamily) {
          const canonical = buildAssistantIdentityFamilyReply(identityIntentFamily, safePrompt);
          if (canonical) {
            const responseStream = streamRequested && streamMode === "sse"
              ? toSseStream(createChunkedTextStream(canonical))
              : createChunkedTextStream(canonical);
            return new Response(responseStream, {
              status: 200,
              headers: {
                "Content-Type":
                  streamRequested && streamMode === "sse"
                    ? "text/event-stream; charset=utf-8"
                    : "text/plain; charset=utf-8",
                "Cache-Control": "no-cache, no-transform",
                Connection: "keep-alive",
                "X-Accel-Buffering": "no",
                "X-KnexAI-Pipeline": "identity-canonical-fallback",
              },
            });
          }
        }
        if (descendingStrict && !allowDirectFallbackAfterDescendingFailure) {
          throw new LlmRouteError(
            503,
            "DESCENDING_PIPELINE_UNAVAILABLE",
            "Pipeline descendente indisponivel para este turno.",
          );
        }
        forceDirectAfterDescendingFailure = true;
      }
    }

    const conversationState = rebuildConversationState({
      conversationKey: conversationKeyFromBody,
      prompt: safePrompt,
      history: normalizedHistory,
      localeHint: localeHintFromBody,
    });
    const conversationStateBlock = buildConversationStateSummaryBlock(conversationState);
    const responsePolicyContext: ResponsePolicyContext = {
      state: conversationState,
      complexity: classifyPromptComplexity(safePrompt),
    };

    let autoWebEvidenceForForcedRag: AutoWebEvidence | null = null;
    if (forceRag) {
      if (shouldRequireWebBeforeRag) {
        logVerificationCascadeStage("search:start", cascade, { routeMode: "force_rag" });
        autoWebEvidenceForForcedRag = await buildAutomaticWebEvidence(verificationTargetPrompt).catch((error) => {
          console.warn("KNEXAI_AUTO_WEB_SEARCH_FAILED", {
            message: error instanceof Error ? error.message : String(error),
          });
          return null;
        });
        const hasWebEvidence = Boolean(autoWebEvidenceForForcedRag && autoWebEvidenceForForcedRag.resultCount > 0);
        logVerificationCascadeStage("search:evidence", cascade, {
          routeMode: "force_rag",
          hasWebEvidence,
          resultCount: autoWebEvidenceForForcedRag?.resultCount || 0,
          domainCount: autoWebEvidenceForForcedRag?.domainCount || 0,
          queryCount: autoWebEvidenceForForcedRag?.queryCount || 0,
        });
        if (!hasWebEvidence) {
          const fallbackText = isAuthorYearReferencePrompt(verificationTargetPrompt)
            ? buildReferenceGroundingRequiredAnswer(localeHintFromBody)
            : buildWebVerificationUnavailableAnswer(localeHintFromBody);
          return new Response(createChunkedTextStream(fallbackText), {
            status: 200,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
        if (forceWebMultiSource && isCurrentOfficeQuestion(verificationTargetPrompt)) {
          const officeCandidates = autoWebEvidenceForForcedRag?.officeCandidates || [];
          const domainCount = autoWebEvidenceForForcedRag?.domainCount || 0;
          if (officeCandidates.length === 1 && domainCount >= 2) {
            const directAnswer = buildDeterministicOfficeAnswer(
              localeHintFromBody,
              officeCandidates[0],
              autoWebEvidenceForForcedRag?.sources || [],
            );
            return new Response(createChunkedTextStream(directAnswer), {
              status: 200,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            });
          }
          const fallbackText = isAuthorYearReferencePrompt(verificationTargetPrompt)
            ? buildReferenceGroundingRequiredAnswer(localeHintFromBody)
            : buildWebVerificationUnavailableAnswer(localeHintFromBody);
          return new Response(createChunkedTextStream(fallbackText), {
            status: 200,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
        console.info("KNEXAI_AUTO_WEB_SEARCH_CONTEXT", {
          verificationPrompt: verificationTargetPrompt,
          queryCount: autoWebEvidenceForForcedRag?.queryCount || 0,
          resultCount: autoWebEvidenceForForcedRag?.resultCount || 0,
          domainCount: autoWebEvidenceForForcedRag?.domainCount || 0,
          sources: autoWebEvidenceForForcedRag?.sources || [],
          officeCandidates: autoWebEvidenceForForcedRag?.officeCandidates || [],
          routePolicy: "force_rag_with_preverified_web",
        });
      }

      console.info("KNEXAI_ROUTE_RAG_POLICY", {
        forceRag,
        requestedForceRag,
        verifiableQuestion,
        verificationTargetPrompt,
        hasDocumentScope,
        forceWebMultiSource,
        shouldForceFullRagMode,
        shouldRequireWebBeforeRag,
      });

      const ragEngineMode =
        forceDirectAfterDescendingFailure
          ? "direct"
          : shouldForceFullRagMode
            ? "direct"
            : anmEngineModeFromBody || engineMode.mode;
      const ragAnmBaseUrl = anmBaseUrlFromBody || engineMode.anmBaseUrl;
      const ragAnmTimeoutMs = anmTimeoutMsFromBody || engineMode.anmTimeoutMs;
      const ragAnmSoftTimeoutMs = anmSoftTimeoutMsFromBody || engineMode.anmSoftTimeoutMs;
      const ragAnmFallbackToDirect =
        shouldRequireWebBeforeRag
          ? false
          : typeof anmFallbackToDirectFromBody === "boolean"
            ? anmFallbackToDirectFromBody
            : engineMode.fallbackToDirect;
      const ragMessage =
        autoWebEvidenceForForcedRag?.contextBlock?.trim()
          ? `${safePrompt}\n\n${autoWebEvidenceForForcedRag.contextBlock}`
          : safePrompt;
      const run = await assistantOrchestrator.run({
        requestId: typeof body?.requestId === "string" ? body.requestId : undefined,
        conversationKey: conversationKeyFromBody,
        mode: "chat",
        stream: streamRequested,
        message: ragMessage,
        conversation: historyForCascade,
        attachments: buildAttachmentsFromComposer(composerAttachmentIds, documentIds),
        ragInput: {
          pipelineVersion,
          composerBound,
          composerAttachmentIds,
          topK,
          maxDistance,
          documentId,
          documentIds,
          sourceType: sourceType || undefined,
          retrievalEmbeddingModel: retrievalEmbeddingModel || undefined,
          pipelineModeOverride: shouldForceFullRagMode ? "full" : undefined,
          preferredResponseLanguageId,
          maxResponseTokens: effectiveMaxResponseTokens,
          temperature,
          seed,
          anmEngineMode: ragEngineMode,
          anmBaseUrl: ragAnmBaseUrl,
          anmTimeoutMs: ragAnmTimeoutMs,
          anmSoftTimeoutMs: ragAnmSoftTimeoutMs,
          anmFallbackToDirect: ragAnmFallbackToDirect,
        },
      });

      if (streamRequested) {
        if (!run.stream) {
          throw new LlmRouteError(500, "ASSISTANT_STREAM_MISSING", "Falha ao abrir stream do assistant pipeline.");
        }
        const responseStream = streamMode === "sse" ? toSseStream(run.stream) : run.stream;
        return new Response(responseStream, {
          status: 200,
          headers: {
            "Content-Type": streamMode === "sse" ? "text/event-stream; charset=utf-8" : "text/plain; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          },
        });
      }
      const ragRawContent = `${run.content || ""}`.trim();
      const ragCleanedContent = stripConversationRoleArtifacts(ragRawContent);
      const ragEnforcedContent = enforceResponseStructure(ragCleanedContent || ragRawContent, {
        state: responsePolicyContext.state,
        complexity: responsePolicyContext.complexity,
      });
      return Response.json(
        {
          ok: true,
          reply: {
            role: "assistant",
            content: ragEnforcedContent || ragCleanedContent || ragRawContent,
          },
          metadata: run.ragMetadata,
          meta: run.meta,
        },
        { status: 200 },
      );
    }
    const autoWebEvidence = await buildAutomaticWebEvidence(verificationTargetPrompt).catch((error) => {
      console.warn("KNEXAI_AUTO_WEB_SEARCH_FAILED", {
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    });
    const autoWebContextBlock = autoWebEvidence?.contextBlock?.trim() || "";
    if (autoWebEvidence) {
      console.info("KNEXAI_AUTO_WEB_SEARCH_CONTEXT", {
        verificationPrompt: verificationTargetPrompt,
        queryCount: autoWebEvidence.queryCount,
        resultCount: autoWebEvidence.resultCount,
        domainCount: autoWebEvidence.domainCount,
        sources: autoWebEvidence.sources,
        officeCandidates: autoWebEvidence.officeCandidates,
      });
    }
    const hasWebEvidence = Boolean(autoWebEvidence && autoWebEvidence.resultCount > 0);
    logVerificationCascadeStage("search:evidence", cascade, {
      routeMode: "direct_only",
      hasWebEvidence,
      resultCount: autoWebEvidence?.resultCount || 0,
      domainCount: autoWebEvidence?.domainCount || 0,
      queryCount: autoWebEvidence?.queryCount || 0,
    });
    if (!forceRag && forceWebMultiSource && verifiableQuestion && !hasWebEvidence) {
      const fallbackText = isAuthorYearReferencePrompt(verificationTargetPrompt)
        ? buildReferenceGroundingRequiredAnswer(localeHintFromBody)
        : buildWebVerificationUnavailableAnswer(localeHintFromBody);
      return new Response(createChunkedTextStream(fallbackText), {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    if (!forceRag && forceWebMultiSource && isCurrentOfficeQuestion(verificationTargetPrompt)) {
      const officeCandidates = autoWebEvidence?.officeCandidates || [];
      const domainCount = autoWebEvidence?.domainCount || 0;
      if (officeCandidates.length === 1 && domainCount >= 2) {
        const directAnswer = buildDeterministicOfficeAnswer(localeHintFromBody, officeCandidates[0], autoWebEvidence?.sources || []);
        return new Response(createChunkedTextStream(directAnswer), {
          status: 200,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
      const fallbackText = isAuthorYearReferencePrompt(verificationTargetPrompt)
        ? buildReferenceGroundingRequiredAnswer(localeHintFromBody)
        : buildWebVerificationUnavailableAnswer(localeHintFromBody);
      return new Response(createChunkedTextStream(fallbackText), {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    const webVerificationPolicyBlock =
      forceWebMultiSource && verifiableQuestion && hasWebEvidence
        ? buildWebVerificationResponsePolicy(localeHintFromBody)
        : "";

    const clientSharedIdentityRuntime =
      normalizeRecord(body?.sharedIdentityRuntime) || normalizeRecord(body?.shared_identity_runtime);
    const identitySharedMemory = await resolveIdentityRuntimeSharedContext();
    const identityContextBlock = identitySharedMemory.promptBlock.trim();
    const promptForAnm = injectConversationStatePrompt(
      [safePrompt, identityContextBlock, autoWebContextBlock, webVerificationPolicyBlock].filter(Boolean).join("\n\n"),
      conversationStateBlock,
    );
    const promptForDirect = safePrompt;
    const directContextBlock = [
      conversationStateBlock.trim(),
      identityContextBlock,
      autoWebContextBlock,
      webVerificationPolicyBlock,
    ]
      .filter(Boolean)
      .join("\n\n");
    const sharedIdentityRuntimePayload = clientSharedIdentityRuntime
      ? {
          source: "client_identity_snapshot",
          client_snapshot: clientSharedIdentityRuntime,
        }
      : null;

    const modelHistoryBase = forceWebMultiSource && verifiableQuestion ? filteredHistoryForVerifiable : normalizedHistory;
    const safeHistory = sanitizeHistoryForModel(ensurePrompt(modelHistoryBase, promptForDirect));
    const effectiveHistory = optimizeHistoryForLatency(
      resolveEffectiveHistory(safeHistory, promptForDirect),
      promptForDirect,
    );
    const safeAnmHistory = sanitizeHistoryForModel(ensurePrompt(modelHistoryBase, promptForDirect));
    const anmEffectiveHistory = optimizeHistoryForLatency(
      resolveEffectiveHistory(safeAnmHistory, promptForDirect),
      promptForDirect,
    );
    const anmRequestOptions = {
      mode: "chat" as const,
      history: anmEffectiveHistory,
      localeHint: localeHintFromBody,
      conversationKey: conversationKeyFromBody,
      userKey: userKeyFromBody,
      };
    const forceDirectForVerifiableQuestion = cascade.forceDirectWithoutDocumentScope;
    const forceDirectEngineMode =
      forceDirectForVerifiableQuestion || forceDirectAfterDescendingFailure;
    const requestedEngineMode = anmEngineModeFromBody;
    const requestedFallbackToDirect =
      typeof anmFallbackToDirectFromBody === "boolean" ? anmFallbackToDirectFromBody : engineMode.fallbackToDirect;
    const preferredEngineMode: EngineModeConfig = forceDirectEngineMode
      ? { ...engineMode, mode: "direct", fallbackToDirect: true }
      : requestedEngineMode
        ? {
            ...engineMode,
            mode: requestedEngineMode,
            anmBaseUrl: anmBaseUrlFromBody || engineMode.anmBaseUrl,
            anmTimeoutMs: anmTimeoutMsFromBody || engineMode.anmTimeoutMs,
            anmSoftTimeoutMs: anmSoftTimeoutMsFromBody || engineMode.anmSoftTimeoutMs,
            fallbackToDirect: requestedEngineMode === "direct" ? true : requestedFallbackToDirect,
          }
        : engineMode;
    logVerificationCascadeStage("engine:gate", cascade, {
      selectedEngineMode: preferredEngineMode.mode,
      configuredEngineMode: engineMode.mode,
      requestedEngineMode: requestedEngineMode || "",
      forceDirectAfterDescendingFailure,
    });
    // Guard definitivo: endpoint opera somente em modo direto.
    const anmResolution: { baseUrl?: string; attemptedBaseUrls?: string[] } | null = null;
    const effectiveEngineMode: EngineModeConfig = {
      ...preferredEngineMode,
      mode: "direct" as EngineMode,
      fallbackToDirect: true,
    };

    if (effectiveEngineMode.mode === "anm") {
      if (effectiveEngineMode.fallbackToDirect) {
        const strictAnmPrimary = parseOptionalBoolean(process.env.KNEXAI_ANM_STRICT_PRIMARY) !== false;
        if (strictAnmPrimary) {
          const anmAttempt = await requestAnmChat(effectiveEngineMode, promptForAnm, sharedIdentityRuntimePayload, anmRequestOptions)
            .then((anm) => toAttemptOk("anm", anm))
            .catch((error: unknown) => toAttemptError("anm", error));
          if (anmAttempt.ok && anmAttempt.source === "anm") {
            console.info("KNEXAI_ANM_CHAT_OK", {
              traceId: anmAttempt.value.traceId,
              anmBaseUrl: effectiveEngineMode.anmBaseUrl,
              answerChars: anmAttempt.value.answer.length,
              routePolicy: "anm_strict_primary",
            });
            return toAnmTextResponse(anmAttempt.value, responsePolicyContext);
          }

          const directHealth = await probeDirectHealth(config);
          if (!directHealth.ok) {
            const directUnavailable = toAttemptError(
              "direct",
              new LlmRouteError(
                503,
                "LLM_UNAVAILABLE",
                `Motor local indisponivel em ${config.baseUrl}. Endpoints tentados: ${(directHealth.attemptedBaseUrls || [config.baseUrl]).join(", ")}.`,
              ),
            );
            throw buildEngineCompositeError([anmAttempt, directUnavailable]);
          }

          const directConfig = applyResolvedLlmBaseUrl(config, directHealth.baseUrl);
          const directAttempt = await requestLlmStreaming(directConfig, effectiveHistory, promptForDirect, directContextBlock)
            .then((upstream) => toAttemptOk("direct", upstream))
            .catch((error: unknown) => toAttemptError("direct", error));
          if (directAttempt.ok && directAttempt.source === "direct") {
            return toClientTextStreamResponse(directAttempt.value, responsePolicyContext);
          }
          throw buildEngineCompositeError([anmAttempt, directAttempt]);
        }

        const [anmHealth, directHealth] = await Promise.all([probeAnmHealth(effectiveEngineMode), probeDirectHealth(config)]);
        const directConfig = applyResolvedLlmBaseUrl(config, directHealth.baseUrl);
        console.info("KNEXAI_ENGINE_HEALTH_SNAPSHOT", {
          mode: effectiveEngineMode.mode,
          anmOk: anmHealth.ok,
          anmStatus: anmHealth.status,
          anmDetail: anmHealth.detail,
          directOk: directHealth.ok,
          directStatus: directHealth.status,
          directDetail: directHealth.detail,
          anmConfiguredBaseUrl: engineMode.anmBaseUrl,
          anmSelectedBaseUrl: effectiveEngineMode.anmBaseUrl,
          anmAttemptedBaseUrls:
            (anmResolution as { attemptedBaseUrls?: string[] } | null)?.attemptedBaseUrls || [engineMode.anmBaseUrl],
          directConfiguredBaseUrl: config.baseUrl,
          directSelectedBaseUrl: directConfig.baseUrl,
          directAttemptedBaseUrls: directHealth.attemptedBaseUrls || [],
          identitySharedMemoryStatus: identitySharedMemory.status,
          identitySharedMemoryChars: identitySharedMemory.promptBlock.length,
        });

        if (anmHealth.ok && !directHealth.ok) {
          const anmAttempt = await requestAnmChat(effectiveEngineMode, promptForAnm, sharedIdentityRuntimePayload, anmRequestOptions)
            .then((anm) => toAttemptOk("anm", anm))
            .catch((error: unknown) => toAttemptError("anm", error));
          if (anmAttempt.ok && anmAttempt.source === "anm") {
            console.info("KNEXAI_ANM_CHAT_OK", {
              traceId: anmAttempt.value.traceId,
              anmBaseUrl: effectiveEngineMode.anmBaseUrl,
              answerChars: anmAttempt.value.answer.length,
              routePolicy: "anm_only_due_direct_unhealthy",
            });
            return toAnmTextResponse(anmAttempt.value, responsePolicyContext);
          }
          const directAttempt = await requestLlmStreaming(directConfig, effectiveHistory, promptForDirect, directContextBlock)
            .then((upstream) => toAttemptOk("direct", upstream))
            .catch((error: unknown) => toAttemptError("direct", error));
          if (directAttempt.ok && directAttempt.source === "direct") {
            return toClientTextStreamResponse(directAttempt.value, responsePolicyContext);
          }
          throw buildEngineCompositeError([anmAttempt, directAttempt]);
        }

        if (!anmHealth.ok && directHealth.ok) {
          const directAttempt = await requestLlmStreaming(directConfig, effectiveHistory, promptForDirect, directContextBlock)
            .then((upstream) => toAttemptOk("direct", upstream))
            .catch((error: unknown) => toAttemptError("direct", error));
          if (directAttempt.ok && directAttempt.source === "direct") {
            return toClientTextStreamResponse(directAttempt.value, responsePolicyContext);
          }
          const anmAttempt = await requestAnmChat(effectiveEngineMode, promptForAnm, sharedIdentityRuntimePayload, anmRequestOptions)
            .then((anm) => toAttemptOk("anm", anm))
            .catch((error: unknown) => toAttemptError("anm", error));
          if (anmAttempt.ok && anmAttempt.source === "anm") {
            console.info("KNEXAI_ANM_CHAT_OK", {
              traceId: anmAttempt.value.traceId,
              anmBaseUrl: effectiveEngineMode.anmBaseUrl,
              answerChars: anmAttempt.value.answer.length,
              routePolicy: "anm_fallback_after_direct_failure",
            });
            return toAnmTextResponse(anmAttempt.value, responsePolicyContext);
          }
          throw buildEngineCompositeError([directAttempt, anmAttempt]);
        }

        if (!anmHealth.ok && !directHealth.ok) {
          throw new LlmRouteError(
            503,
            "ENGINE_PATHS_UNAVAILABLE",
            `ANM indisponivel (${anmHealth.detail}) e LLM direta indisponivel (${directHealth.detail}).` +
              ` Endpoints ANM tentados: ${(
                (anmResolution as { attemptedBaseUrls?: string[] } | null)?.attemptedBaseUrls ||
                [effectiveEngineMode.anmBaseUrl]
              ).join(", ")}.` +
              ` Endpoints diretos tentados: ${(directHealth.attemptedBaseUrls || [config.baseUrl]).join(", ")}.`,
          );
        }

        const anmSoftPromise = requestAnmChat(
          { ...effectiveEngineMode, anmTimeoutMs: effectiveEngineMode.anmSoftTimeoutMs },
          promptForAnm,
          sharedIdentityRuntimePayload,
          anmRequestOptions,
        )
          .then((anm) => toAttemptOk("anm", anm))
          .catch((error: unknown) => toAttemptError("anm", error));
        const directPromise = requestLlmStreaming(directConfig, effectiveHistory, promptForDirect, directContextBlock)
          .then((upstream) => toAttemptOk("direct", upstream))
          .catch((error: unknown) => toAttemptError("direct", error));

        const first = await Promise.race([anmSoftPromise, directPromise]);
        if (first.ok && first.source === "anm") {
          const anm = first.value as AnmChatResult;
          console.info("KNEXAI_ANM_CHAT_OK", {
            traceId: anm.traceId,
            anmBaseUrl: effectiveEngineMode.anmBaseUrl,
            answerChars: anm.answer.length,
            routePolicy: "anm_soft_won_race",
          });
          return toAnmTextResponse(anm, responsePolicyContext);
        }
        if (first.ok && first.source === "direct") {
          const upstream = first.value as Response;
          return toClientTextStreamResponse(upstream, responsePolicyContext);
        }

        if (!first.ok && first.source === "anm") {
          const second = await directPromise;
          if (second.ok && second.source === "direct") {
            return toClientTextStreamResponse(second.value, responsePolicyContext);
          }
          const hardAnm = await requestAnmChat(effectiveEngineMode, promptForAnm, sharedIdentityRuntimePayload, anmRequestOptions)
            .then((anm) => toAttemptOk("anm", anm))
            .catch((error: unknown) => toAttemptError("anm", error));
          if (hardAnm.ok && hardAnm.source === "anm") {
            console.info("KNEXAI_ANM_CHAT_OK", {
              traceId: hardAnm.value.traceId,
              anmBaseUrl: effectiveEngineMode.anmBaseUrl,
              answerChars: hardAnm.value.answer.length,
              routePolicy: "anm_hard_retry_after_soft_timeout",
            });
            return toAnmTextResponse(hardAnm.value, responsePolicyContext);
          }
          throw buildEngineCompositeError([first, second, hardAnm]);
        }

        if (!first.ok && first.source === "direct") {
          const hardAnm = await requestAnmChat(effectiveEngineMode, promptForAnm, sharedIdentityRuntimePayload, anmRequestOptions)
            .then((anm) => toAttemptOk("anm", anm))
            .catch((error: unknown) => toAttemptError("anm", error));
          if (hardAnm.ok && hardAnm.source === "anm") {
            console.info("KNEXAI_ANM_CHAT_OK", {
              traceId: hardAnm.value.traceId,
              anmBaseUrl: effectiveEngineMode.anmBaseUrl,
              answerChars: hardAnm.value.answer.length,
              routePolicy: "anm_hard_after_direct_failure",
            });
            return toAnmTextResponse(hardAnm.value, responsePolicyContext);
          }
          throw buildEngineCompositeError([first, hardAnm]);
        }
      } else {
        const anm = await requestAnmChat(effectiveEngineMode, promptForAnm, sharedIdentityRuntimePayload, anmRequestOptions);
        console.info("KNEXAI_ANM_CHAT_OK", {
          traceId: anm.traceId,
          anmBaseUrl: effectiveEngineMode.anmBaseUrl,
          answerChars: anm.answer.length,
        });
        return toAnmTextResponse(anm, responsePolicyContext);
      }
    }

    const directHealth = await probeDirectHealth(config);
    if (!directHealth.ok) {
      throw new LlmRouteError(
        503,
        "LLM_UNAVAILABLE",
        `Motor local indisponivel em ${config.baseUrl}. Endpoints tentados: ${(directHealth.attemptedBaseUrls || [config.baseUrl]).join(", ")}.`,
      );
    }
    const directConfig = applyResolvedLlmBaseUrl(config, directHealth.baseUrl);
    const upstream = await requestLlmStreaming(directConfig, effectiveHistory, promptForDirect, directContextBlock);
    return toClientTextStreamResponse(upstream, responsePolicyContext);
  } catch (error) {
    if (error instanceof LlmRouteError) {
      console.error("KNEXAI_LLM_ERROR", { code: error.code, status: error.status, message: error.message });
      return safeBackendError(error.status, error.code, error.message);
    }
    if (error instanceof RagPipelineError) {
      console.error("KNEXAI_RAG_PIPELINE_ERROR", { code: error.code, status: error.status, message: error.message });
      return safeBackendError(error.status, error.code, error.message);
    }
    console.error("KNEXAI_POST_UNEXPECTED_ERROR", error);
    return safeBackendError(500, "INTERNAL_ERROR", "Erro interno ao processar a requisicao.");
  }
}









