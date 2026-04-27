/**
 * Layer: 14-reasoning-and-generation-layer/problem-resolution-core
 * Module: observation-limit-extractor
 * Responsibility: Extract abstract observation/access limits and detect violations in drafts.
 */

import type { ObservationLimit } from "./problem-resolution-types";

export interface ObservationLimitViolation {
  violated: boolean;
  reasons: string[];
  rawSignals: string[];
}

type ObservationLimitType = ObservationLimit["type"];

interface AccessLimitSignal {
  readonly type: ObservationLimitType;
  readonly scope?: string;
  readonly rawSignal: string;
  readonly sentence: string;
}

interface ViolationSignal {
  readonly reason: string;
  readonly rawSignal: string;
}

const NEGATION_MARKERS = [
  "nao",
  "sem",
  "nunca",
  "jamais",
  "proibido",
  "vedado",
  "cannot",
  "can not",
  "must not",
  "do not",
  "dont",
  "without",
  "never",
  "forbidden",
  "not allowed",
  "no",
];

const ACCESS_OPERATION_MARKERS = [
  "observar",
  "observacao",
  "olhar",
  "ver",
  "verificar",
  "checar",
  "inspecionar",
  "examinar",
  "abrir",
  "consultar",
  "acessar",
  "obter informacao",
  "perguntar",
  "medir",
  "testar",
  "observe",
  "observation",
  "look",
  "see",
  "check",
  "inspect",
  "examine",
  "open",
  "consult",
  "access",
  "obtain information",
  "ask",
  "measure",
  "test",
];

const ACCESS_NOUN_MARKERS = [
  "informacao",
  "informacoes",
  "dado",
  "dados",
  "fonte",
  "fontes",
  "observacao",
  "observacoes",
  "inspecao",
  "inspecoes",
  "consulta",
  "consultas",
  "medicao",
  "medicoes",
  "teste",
  "testes",
  "information",
  "data",
  "source",
  "sources",
  "observation",
  "observations",
  "inspection",
  "inspections",
  "query",
  "queries",
  "measurement",
  "measurements",
  "test",
  "tests",
];

const SINGLE_OBSERVATION_MARKERS = [
  "uma unica observacao",
  "um unico acesso",
  "uma unica verificacao",
  "uma vez",
  "apenas uma observacao",
  "somente uma observacao",
  "uma observacao apenas",
  "uma observacao somente",
  "only one observation",
  "single observation",
  "one single observation",
  "observe once",
  "one observation",
  "only once",
  "one time",
];

const ADDITIONAL_ACCESS_MARKERS = [
  "adicional",
  "adicionais",
  "outra vez",
  "novamente",
  "de novo",
  "mais uma vez",
  "extra",
  "outro acesso",
  "outra observacao",
  "segunda observacao",
  "terceira observacao",
  "nova verificacao",
  "additional",
  "again",
  "once more",
  "extra",
  "another access",
  "another observation",
  "second observation",
  "third observation",
  "new check",
];

const HIDDEN_OR_UNSELECTED_SCOPE_MARKERS = [
  "oculto",
  "oculta",
  "escondido",
  "escondida",
  "interno",
  "interna",
  "dentro",
  "nao selecionado",
  "nao selecionada",
  "nao escolhida",
  "nao escolhido",
  "demais",
  "restantes",
  "outras",
  "outros",
  "hidden",
  "inside",
  "unselected",
  "unchosen",
  "remaining",
  "other",
  "others",
];

const SOURCE_SCOPE_MARKERS = [
  "fonte",
  "fontes",
  "documento",
  "documentos",
  "base",
  "bases",
  "referencia",
  "referencias",
  "source",
  "sources",
  "document",
  "documents",
  "database",
  "databases",
  "reference",
  "references",
];

const UNIVERSAL_EXPANSION_MARKERS = [
  "todos",
  "todas",
  "cada",
  "cada um",
  "cada uma",
  "uma por vez",
  "um por vez",
  "demais",
  "restantes",
  "outras",
  "outros",
  "all",
  "every",
  "each",
  "one by one",
  "one at a time",
  "remaining",
  "others",
];

const SAFE_INFERENCE_MARKERS = [
  "inferir",
  "deduzir",
  "concluir",
  "por eliminacao",
  "por eliminação",
  "a partir",
  "com base",
  "dessa observacao",
  "dessa observação",
  "dessa unica observacao",
  "dessa única observação",
  "infer",
  "deduce",
  "conclude",
  "by elimination",
  "from that observation",
  "from the single observation",
  "based on",
];

export function extractObservationLimits(inputText: string): ObservationLimit[] {
  const source = String(inputText ?? "").trim();

  if (!source) {
    return [];
  }

  const sentences = splitSentences(source);
  const signals = sentences.flatMap((sentence) => extractSignalsFromSentence(sentence));

  return dedupeObservationLimits(
    signals.map((signal) => ({
      type: signal.type,
      scope: signal.scope,
      rawSignals: [signal.rawSignal],
    })),
  );
}

export function detectObservationLimitViolation(
  observationLimits: ObservationLimit[] | undefined,
  draftAnswer: string,
): ObservationLimitViolation {
  const limits = Array.isArray(observationLimits) ? observationLimits : [];

  if (limits.length === 0) {
    return {
      violated: false,
      reasons: [],
      rawSignals: [],
    };
  }

  const sentences = splitSentences(draftAnswer);
  const violations: ViolationSignal[] = [];

  for (const sentence of sentences) {
    const normalizedSentence = normalize(sentence);

    if (!normalizedSentence) {
      continue;
    }

    if (isSafeInferenceSentence(normalizedSentence)) {
      continue;
    }

    if (isProhibitiveSentence(normalizedSentence)) {
      continue;
    }

    for (const limit of limits) {
      const violation = detectViolationForLimit(limit, normalizedSentence);

      if (violation) {
        violations.push(violation);
      }
    }
  }

  return {
    violated: violations.length > 0,
    reasons: dedupe(violations.map((violation) => violation.reason)),
    rawSignals: dedupe(violations.map((violation) => violation.rawSignal)),
  };
}

function extractSignalsFromSentence(sentence: string): AccessLimitSignal[] {
  const normalizedSentence = normalize(sentence);
  const signals: AccessLimitSignal[] = [];

  if (!normalizedSentence) {
    return signals;
  }

  const hasNegation = containsAny(normalizedSentence, NEGATION_MARKERS);
  const hasAccessOperation = containsAny(normalizedSentence, ACCESS_OPERATION_MARKERS);
  const hasAccessNoun = containsAny(normalizedSentence, ACCESS_NOUN_MARKERS);
  const hasSingleObservation = containsAny(normalizedSentence, SINGLE_OBSERVATION_MARKERS);
  const hasAdditionalMarker = containsAny(normalizedSentence, ADDITIONAL_ACCESS_MARKERS);
  const hasHiddenScope = containsAny(normalizedSentence, HIDDEN_OR_UNSELECTED_SCOPE_MARKERS);
  const hasSourceScope = containsAny(normalizedSentence, SOURCE_SCOPE_MARKERS);

  if (hasSingleObservation) {
    signals.push({
      type: "single_observation_only",
      scope: hasHiddenScope ? "single_selected_entity" : "single_access_event",
      rawSignal: sentence,
      sentence,
    });
  }

  if (hasNegation && hasAccessOperation && hasHiddenScope) {
    signals.push({
      type: "no_hidden_inspection",
      scope: "unselected_or_hidden_scope",
      rawSignal: sentence,
      sentence,
    });
  }

  if (hasNegation && hasSourceScope && (hasAccessOperation || hasAccessNoun)) {
    signals.push({
      type: "limited_source_access",
      scope: "limited_source_access",
      rawSignal: sentence,
      sentence,
    });
  }

  if (
    hasNegation &&
    (hasAdditionalMarker || hasAccessOperation || hasAccessNoun) &&
    !signals.some((signal) => signal.type === "no_hidden_inspection")
  ) {
    signals.push({
      type: "no_additional_observation",
      scope: hasSourceScope ? "additional_sources" : "additional_information",
      rawSignal: sentence,
      sentence,
    });
  }

  return dedupeSignals(signals);
}

function detectViolationForLimit(
  limit: ObservationLimit,
  normalizedSentence: string,
): ViolationSignal | null {
  const hasAccessOperation = containsAny(normalizedSentence, ACCESS_OPERATION_MARKERS);
  const hasAccessNoun = containsAny(normalizedSentence, ACCESS_NOUN_MARKERS);
  const hasAdditionalAccess = containsAny(normalizedSentence, ADDITIONAL_ACCESS_MARKERS);
  const hasHiddenScope = containsAny(normalizedSentence, HIDDEN_OR_UNSELECTED_SCOPE_MARKERS);
  const hasSourceScope = containsAny(normalizedSentence, SOURCE_SCOPE_MARKERS);
  const hasUniversalExpansion = containsAny(normalizedSentence, UNIVERSAL_EXPANSION_MARKERS);

  if (!hasAccessOperation && !hasAccessNoun) {
    return null;
  }

  if (limit.type === "no_hidden_inspection") {
    if (hasHiddenScope || hasUniversalExpansion) {
      return {
        reason:
          "draft requires access to hidden, unselected, remaining or other targets despite an observation/access limit",
        rawSignal: normalizedSentence,
      };
    }

    return null;
  }

  if (limit.type === "no_additional_observation") {
    if (hasAdditionalAccess || hasUniversalExpansion || hasSourceScope) {
      return {
        reason:
          "draft requires additional observation, checking, consultation or information access despite an observation/access limit",
        rawSignal: normalizedSentence,
      };
    }

    return null;
  }

  if (limit.type === "single_observation_only") {
    if (hasAdditionalAccess || hasUniversalExpansion) {
      return {
        reason:
          "draft expands a single observation/access event into repeated or multi-target observation",
        rawSignal: normalizedSentence,
      };
    }

    return null;
  }

  if (limit.type === "limited_source_access") {
    if (hasSourceScope && (hasAdditionalAccess || hasUniversalExpansion || hasHiddenScope)) {
      return {
        reason:
          "draft expands source access beyond the allowed source or access limit",
        rawSignal: normalizedSentence,
      };
    }

    if (hasAdditionalAccess && hasAccessOperation) {
      return {
        reason:
          "draft requires additional source consultation or checking beyond the allowed limit",
        rawSignal: normalizedSentence,
      };
    }

    return null;
  }

  return null;
}

function isSafeInferenceSentence(normalizedSentence: string): boolean {
  const hasSafeInference = containsAny(normalizedSentence, SAFE_INFERENCE_MARKERS);
  const hasExpansion =
    containsAny(normalizedSentence, ADDITIONAL_ACCESS_MARKERS) ||
    containsAny(normalizedSentence, UNIVERSAL_EXPANSION_MARKERS);

  return hasSafeInference && !hasExpansion;
}

function isProhibitiveSentence(normalizedSentence: string): boolean {
  const hasNegation = containsAny(normalizedSentence, NEGATION_MARKERS);
  const hasAccess =
    containsAny(normalizedSentence, ACCESS_OPERATION_MARKERS) ||
    containsAny(normalizedSentence, ACCESS_NOUN_MARKERS);

  if (!hasNegation || !hasAccess) {
    return false;
  }

  const hasPositiveExpansion =
    containsAny(normalizedSentence, ADDITIONAL_ACCESS_MARKERS) ||
    containsAny(normalizedSentence, UNIVERSAL_EXPANSION_MARKERS);

  return !hasPositiveExpansion;
}

function splitSentences(text: string): string[] {
  return String(text ?? "")
    .split(/[.!?;:\n]+/g)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function containsAny(text: string, markers: readonly string[]): boolean {
  return markers.some((marker) => containsMarker(text, marker));
}

function containsMarker(text: string, marker: string): boolean {
  const normalizedText = normalize(text);
  const normalizedMarker = normalize(marker);

  if (!normalizedText || !normalizedMarker) {
    return false;
  }

  if (normalizedMarker.includes(" ")) {
    return normalizedText.includes(normalizedMarker);
  }

  return new RegExp(`\\b${escapeRegExp(normalizedMarker)}\\b`).test(normalizedText);
}

function dedupe(values: ReadonlyArray<string>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const cleaned = String(value ?? "").trim();
    const key = normalize(cleaned);

    if (!cleaned || !key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

function dedupeSignals(signals: readonly AccessLimitSignal[]): AccessLimitSignal[] {
  const byKey = new Map<string, AccessLimitSignal>();

  for (const signal of signals) {
    const key = `${signal.type}:${normalize(signal.scope ?? "")}:${normalize(signal.rawSignal)}`;

    if (!byKey.has(key)) {
      byKey.set(key, signal);
    }
  }

  return Array.from(byKey.values());
}

function dedupeObservationLimits(limits: ObservationLimit[]): ObservationLimit[] {
  const byKey = new Map<string, ObservationLimit>();

  for (const limit of limits) {
    const key = `${limit.type}:${normalize(limit.scope ?? "")}`;
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, {
        ...limit,
        rawSignals: dedupe(limit.rawSignals),
      });
      continue;
    }

    byKey.set(key, {
      ...existing,
      rawSignals: dedupe([
        ...safeStringArray(existing.rawSignals),
        ...safeStringArray(limit.rawSignals),
      ]),
    });
  }

  return Array.from(byKey.values());
}

function safeStringArray(values: readonly unknown[] | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return dedupe(
    values
      .map((value) => String(value ?? "").trim())
      .filter(Boolean),
  );
}

function normalize(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s_.:-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}