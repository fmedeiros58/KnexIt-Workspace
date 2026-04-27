import type { CouncilRiskLevel } from "../council-types";

export interface ConfidenceCalibrationInput {
  readonly draftAnswer: string;
  readonly hasEvidence: boolean;

  readonly hasStrongLogicalSupport?: boolean;
  readonly hasUnsupportedClaims?: boolean;
  readonly hasContradictions?: boolean;
  readonly hasRequiredRevisions?: boolean;

  readonly evidenceRisk?: CouncilRiskLevel;
  readonly logicRisk?: CouncilRiskLevel;
  readonly completenessRisk?: CouncilRiskLevel;
}

export interface ConfidenceCalibrationResult {
  readonly risk: CouncilRiskLevel;
  readonly level: CouncilRiskLevel;
  readonly score: number;
  readonly notes: string[];
  readonly reasons: string[];
}

interface CalibrationSignal {
  readonly note: string;
  readonly penalty: number;
  readonly minimumRisk?: CouncilRiskLevel;
}

const RISK_WEIGHT: Record<CouncilRiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

const HEDGING_MARKERS = [
  "talvez",
  "possivelmente",
  "provavelmente",
  "pode ser",
  "depende",
  "nao sei",
  "não sei",
  "acho que",
  "me parece",
  "nao da para afirmar",
  "não dá para afirmar",
  "fica dificil dizer",
  "fica difícil dizer",
  "maybe",
  "perhaps",
  "possibly",
  "probably",
  "it depends",
  "i do not know",
  "i don't know",
  "i think",
  "it seems",
  "hard to say",
];

const CERTAINTY_MARKERS = [
  "com certeza",
  "sem duvida",
  "sem dúvida",
  "certamente",
  "definitivamente",
  "obviamente",
  "claramente",
  "necessariamente",
  "nao ha duvida",
  "não há dúvida",
  "fica provado",
  "esta provado",
  "está provado",
  "certainly",
  "undoubtedly",
  "definitely",
  "obviously",
  "clearly",
  "necessarily",
  "there is no doubt",
  "it is proven",
];

const ABSOLUTE_MARKERS = [
  "sempre",
  "nunca",
  "todos",
  "todas",
  "nenhum",
  "nenhuma",
  "jamais",
  "sem excecao",
  "sem exceção",
  "em todos os casos",
  "em qualquer caso",
  "always",
  "never",
  "all",
  "none",
  "without exception",
  "in all cases",
  "every case",
];

const CAVEAT_MARKERS = [
  "ressalva",
  "limite",
  "limitação",
  "limitacao",
  "incerteza",
  "depende",
  "desde que",
  "a menos que",
  "com os dados disponiveis",
  "com os dados disponíveis",
  "nao e possivel afirmar",
  "não é possível afirmar",
  "limitation",
  "caveat",
  "uncertainty",
  "depends",
  "provided that",
  "unless",
  "with the available information",
  "cannot conclude",
];

const SUPPORT_MARKERS = [
  "porque",
  "pois",
  "uma vez que",
  "considerando",
  "com base",
  "a partir",
  "portanto",
  "logo",
  "assim",
  "dados",
  "evidencia",
  "evidência",
  "fonte",
  "documento",
  "calculo",
  "cálculo",
  "codigo",
  "código",
  "teste",
  "validacao",
  "validação",
  "because",
  "since",
  "given that",
  "based on",
  "therefore",
  "thus",
  "data",
  "evidence",
  "source",
  "document",
  "calculation",
  "code",
  "test",
  "validation",
];

const DIRECT_CONCLUSION_MARKERS = [
  "a conclusão",
  "a conclusao",
  "portanto",
  "logo",
  "assim",
  "em resumo",
  "o ponto central",
  "a resposta",
  "concluindo",
  "therefore",
  "thus",
  "in conclusion",
  "in summary",
  "the answer",
  "the central point",
];

export function scoreConfidenceCalibration(
  input: ConfidenceCalibrationInput,
): ConfidenceCalibrationResult {
  const normalizedDraft = normalize(input.draftAnswer);
  const context = buildCalibrationContext(input, normalizedDraft);
  const signals = dedupeSignals([
    ...detectOverconfidenceSignals(context),
    ...detectUnderconfidenceSignals(context),
    ...detectInstabilitySignals(context),
  ]);

  const rawScore = signals.reduce((total, signal) => total + signal.penalty, 0);
  const score = round(clamp(rawScore, 0, 1), 3);
  const scoreRisk = riskFromScore(score);
  const minimumRisk = signals.reduce<CouncilRiskLevel>(
    (highest, signal) =>
      signal.minimumRisk ? maxRisk(highest, signal.minimumRisk) : highest,
    "low",
  );
  const risk = maxRisk(scoreRisk, minimumRisk);
  const notes = dedupe(signals.map((signal) => signal.note));

  return {
    risk,
    level: risk,
    score,
    notes,
    reasons: notes,
  };
}

function buildCalibrationContext(
  input: ConfidenceCalibrationInput,
  normalizedDraft: string,
): {
  readonly draft: string;
  readonly hasEvidence: boolean;
  readonly hasStrongLogicalSupport: boolean;
  readonly hasUnsupportedClaims: boolean;
  readonly hasContradictions: boolean;
  readonly hasRequiredRevisions: boolean;
  readonly evidenceRisk: CouncilRiskLevel;
  readonly logicRisk: CouncilRiskLevel;
  readonly completenessRisk: CouncilRiskLevel;
  readonly hedgeCount: number;
  readonly certaintyCount: number;
  readonly absoluteCount: number;
  readonly caveatCount: number;
  readonly supportCount: number;
  readonly conclusionCount: number;
  readonly repeatedUncertainty: boolean;
  readonly repeatedCertainty: boolean;
} {
  return {
    draft: normalizedDraft,
    hasEvidence: input.hasEvidence,
    hasStrongLogicalSupport: Boolean(input.hasStrongLogicalSupport),
    hasUnsupportedClaims: Boolean(input.hasUnsupportedClaims),
    hasContradictions: Boolean(input.hasContradictions),
    hasRequiredRevisions: Boolean(input.hasRequiredRevisions),
    evidenceRisk: normalizeRisk(input.evidenceRisk),
    logicRisk: normalizeRisk(input.logicRisk),
    completenessRisk: normalizeRisk(input.completenessRisk),
    hedgeCount: countMarkerHits(normalizedDraft, HEDGING_MARKERS),
    certaintyCount: countMarkerHits(normalizedDraft, CERTAINTY_MARKERS),
    absoluteCount: countMarkerHits(normalizedDraft, ABSOLUTE_MARKERS),
    caveatCount: countMarkerHits(normalizedDraft, CAVEAT_MARKERS),
    supportCount: countMarkerHits(normalizedDraft, SUPPORT_MARKERS),
    conclusionCount: countMarkerHits(normalizedDraft, DIRECT_CONCLUSION_MARKERS),
    repeatedUncertainty: hasRepeatedMarkerPattern(normalizedDraft, [
      "talvez",
      "pode ser",
      "depende",
      "maybe",
      "perhaps",
      "it depends",
    ]),
    repeatedCertainty: hasRepeatedMarkerPattern(normalizedDraft, [
      "com certeza",
      "sem duvida",
      "sem dúvida",
      "obviamente",
      "certainly",
      "undoubtedly",
      "obviously",
    ]),
  };
}

function detectOverconfidenceSignals(
  context: ReturnType<typeof buildCalibrationContext>,
): CalibrationSignal[] {
  const signals: CalibrationSignal[] = [];

  const hasEvidenceRisk = isRiskAtLeast(context.evidenceRisk, "medium");
  const hasReasoningRisk =
    isRiskAtLeast(context.logicRisk, "medium") ||
    isRiskAtLeast(context.completenessRisk, "medium");

  if (
    context.certaintyCount > 0 &&
    !context.hasEvidence &&
    !context.hasStrongLogicalSupport
  ) {
    signals.push({
      note: "certainty_without_support",
      penalty: 0.32,
      minimumRisk: "medium",
    });
  }

  if (context.certaintyCount >= 2 && !context.hasEvidence) {
    signals.push({
      note: "repeated_certainty_without_external_support",
      penalty: 0.24,
      minimumRisk: "medium",
    });
  }

  if (context.repeatedCertainty && !context.hasEvidence) {
    signals.push({
      note: "repetitive_certainty_pattern",
      penalty: 0.18,
      minimumRisk: "medium",
    });
  }

  if (context.certaintyCount > 0 && context.hasUnsupportedClaims) {
    signals.push({
      note: "certainty_with_unsupported_claims",
      penalty: 0.3,
      minimumRisk: "high",
    });
  }

  if (context.certaintyCount > 0 && context.hasContradictions) {
    signals.push({
      note: "certainty_with_unresolved_contradictions",
      penalty: 0.38,
      minimumRisk: "high",
    });
  }

  if (context.certaintyCount > 0 && context.hasRequiredRevisions) {
    signals.push({
      note: "certainty_with_required_revisions_pending",
      penalty: 0.18,
      minimumRisk: "medium",
    });
  }

  if (context.certaintyCount > 0 && hasEvidenceRisk) {
    signals.push({
      note: "certainty_conflicts_with_evidence_risk",
      penalty: 0.22,
      minimumRisk: "medium",
    });
  }

  if (context.certaintyCount > 0 && hasReasoningRisk) {
    signals.push({
      note: "certainty_conflicts_with_reasoning_risk",
      penalty: 0.22,
      minimumRisk: "medium",
    });
  }

  if (
    context.absoluteCount > 0 &&
    context.caveatCount === 0 &&
    (!context.hasEvidence || hasEvidenceRisk || context.hasUnsupportedClaims)
  ) {
    signals.push({
      note: "absolute_generalization_without_boundary",
      penalty: 0.24,
      minimumRisk: "medium",
    });
  }

  return signals;
}

function detectUnderconfidenceSignals(
  context: ReturnType<typeof buildCalibrationContext>,
): CalibrationSignal[] {
  const signals: CalibrationSignal[] = [];

  const hasSupport =
    context.hasEvidence ||
    context.hasStrongLogicalSupport ||
    context.supportCount >= 2;

  const hasNoMaterialBlockingRisk =
    !context.hasUnsupportedClaims &&
    !context.hasContradictions &&
    !isRiskAtLeast(context.evidenceRisk, "medium") &&
    !isRiskAtLeast(context.logicRisk, "medium") &&
    !isRiskAtLeast(context.completenessRisk, "medium");

  if (context.hedgeCount >= 3 && hasSupport && hasNoMaterialBlockingRisk) {
    signals.push({
      note: "underconfident_despite_available_support",
      penalty: 0.34,
      minimumRisk: "medium",
    });
  }

  if (context.repeatedUncertainty && hasSupport && hasNoMaterialBlockingRisk) {
    signals.push({
      note: "repetitive_uncertainty_pattern",
      penalty: 0.2,
      minimumRisk: "medium",
    });
  }

  if (
    context.hedgeCount >= 2 &&
    context.conclusionCount === 0 &&
    hasSupport &&
    hasNoMaterialBlockingRisk
  ) {
    signals.push({
      note: "hedging_without_clear_conclusion",
      penalty: 0.18,
      minimumRisk: "medium",
    });
  }

  return signals;
}

function detectInstabilitySignals(
  context: ReturnType<typeof buildCalibrationContext>,
): CalibrationSignal[] {
  const signals: CalibrationSignal[] = [];

  if (context.hedgeCount > 0 && context.certaintyCount > 0) {
    signals.push({
      note: "confidence_tone_instability",
      penalty: 0.18,
      minimumRisk: "medium",
    });
  }

  if (
    context.certaintyCount > 0 &&
    context.caveatCount > 0 &&
    context.supportCount === 0
  ) {
    signals.push({
      note: "certainty_and_caveat_without_support_bridge",
      penalty: 0.14,
      minimumRisk: "medium",
    });
  }

  return signals;
}

function countMarkerHits(text: string, markers: readonly string[]): number {
  let count = 0;

  for (const marker of markers) {
    const normalizedMarker = normalize(marker);

    if (!normalizedMarker) {
      continue;
    }

    if (normalizedMarker.includes(" ")) {
      if (text.includes(normalizedMarker)) {
        count += 1;
      }

      continue;
    }

    const regex = new RegExp(`\\b${escapeRegExp(normalizedMarker)}\\b`, "g");
    count += text.match(regex)?.length ?? 0;
  }

  return count;
}

function hasRepeatedMarkerPattern(
  text: string,
  markers: readonly string[],
): boolean {
  for (const marker of markers) {
    const normalizedMarker = normalize(marker);

    if (!normalizedMarker) {
      continue;
    }

    const escaped = escapeRegExp(normalizedMarker);
    const pattern = new RegExp(
      `(?:\\b${escaped}\\b[^.?!]{0,40}){2,}`,
      "i",
    );

    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
}

function riskFromScore(score: number): CouncilRiskLevel {
  if (score >= 0.86) return "critical";
  if (score >= 0.7) return "high";
  if (score >= 0.35) return "medium";
  return "low";
}

function maxRisk(
  left: CouncilRiskLevel,
  right: CouncilRiskLevel,
): CouncilRiskLevel {
  return riskWeight(left) >= riskWeight(right) ? left : right;
}

function isRiskAtLeast(
  risk: CouncilRiskLevel,
  minimum: CouncilRiskLevel,
): boolean {
  return riskWeight(risk) >= riskWeight(minimum);
}

function riskWeight(risk: CouncilRiskLevel): number {
  switch (risk) {
    case "critical":
      return 3;
    case "high":
      return 2;
    case "medium":
      return 1;
    case "low":
    default:
      return 0;
  }
}

function normalizeRisk(risk: CouncilRiskLevel | undefined): CouncilRiskLevel {
  if (
    risk === "low" ||
    risk === "medium" ||
    risk === "high" ||
    risk === "critical"
  ) {
    return risk;
  }

  return "low";
}

function normalize(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeSignals(signals: readonly CalibrationSignal[]): CalibrationSignal[] {
  const byNote = new Map<string, CalibrationSignal>();

  for (const signal of signals) {
    const key = normalize(signal.note);
    const existing = byNote.get(key);

    if (!existing) {
      byNote.set(key, signal);
      continue;
    }

    byNote.set(key, {
      note: existing.note,
      penalty: Math.max(existing.penalty, signal.penalty),
      minimumRisk: signal.minimumRisk
        ? maxRisk(existing.minimumRisk ?? "low", signal.minimumRisk)
        : existing.minimumRisk,
    });
  }

  return Array.from(byNote.values());
}

function dedupe(values: readonly string[]): string[] {
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, decimals = 3): number {
  const factor = 10 ** Math.max(0, Math.floor(decimals));

  return Math.round(value * factor) / factor;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}