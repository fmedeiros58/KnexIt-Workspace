import type {
  CouncilAdvisorReport,
  CouncilRiskLevel,
  CouncilScoringState,
  UnsupportedConfidenceGuardResult,
} from "../council-types";

interface UnsupportedConfidenceInput {
  readonly draftAnswer: string;
  readonly advisorReports: CouncilAdvisorReport[];
  readonly scores: CouncilScoringState;
}

interface ConfidenceContext {
  readonly draft: string;
  readonly evidenceRisk: CouncilRiskLevel;
  readonly confidenceCalibrationRisk: CouncilRiskLevel;
  readonly confidenceCalibrationReasons: string[];
  readonly unsupportedClaims: string[];
  readonly contradictions: string[];
  readonly missingCounterpoints: string[];
  readonly requiredRevisions: string[];
  readonly hasEvidenceRisk: boolean;
  readonly hasLogicRisk: boolean;
  readonly hasCompletenessRisk: boolean;
  readonly hasUnsupportedClaims: boolean;
  readonly hasContradictions: boolean;
  readonly hasRequiredRevisions: boolean;
  readonly hasSufficientSupportSignal: boolean;
}

const RISK_WEIGHT: Record<CouncilRiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

const HIGH_CONFIDENCE_MARKERS = [
  "com certeza",
  "sem duvida",
  "sem dúvida",
  "obviamente",
  "claramente",
  "definitivamente",
  "certamente",
  "necessariamente",
  "evidentemente",
  "sem sombra de duvida",
  "sem sombra de dúvida",
  "nao ha duvida",
  "não há dúvida",
  "fica provado",
  "esta provado",
  "está provado",
  "certainly",
  "undoubtedly",
  "obviously",
  "clearly",
  "definitely",
  "necessarily",
  "evidently",
  "there is no doubt",
  "it is proven",
];

const ABSOLUTE_GENERALIZATION_MARKERS = [
  "sempre",
  "nunca",
  "todos",
  "todas",
  "nenhum",
  "nenhuma",
  "jamais",
  "em qualquer caso",
  "em todos os casos",
  "sem excecao",
  "sem exceção",
  "always",
  "never",
  "all",
  "none",
  "every case",
  "in all cases",
  "without exception",
];

const HEDGING_MARKERS = [
  "talvez",
  "pode ser",
  "possivelmente",
  "provavelmente",
  "parece que",
  "me parece",
  "eu acho",
  "acho que",
  "nao sei",
  "não sei",
  "depende",
  "fica dificil dizer",
  "fica difícil dizer",
  "nao da para afirmar",
  "não dá para afirmar",
  "maybe",
  "perhaps",
  "possibly",
  "probably",
  "it seems",
  "i think",
  "i am not sure",
  "not sure",
  "it depends",
  "hard to say",
];

const SUPPORT_MARKERS = [
  "porque",
  "pois",
  "uma vez que",
  "considerando",
  "com base",
  "a partir",
  "decorre",
  "portanto",
  "logo",
  "assim",
  "evidencia",
  "evidência",
  "dado",
  "dados",
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
  "evidence",
  "data",
  "source",
  "document",
  "calculation",
  "code",
  "test",
  "validation",
];

const CAVEAT_MARKERS = [
  "depende",
  "ressalva",
  "limite",
  "limitacao",
  "limitação",
  "incerteza",
  "desde que",
  "a menos que",
  "com os dados disponiveis",
  "com os dados disponíveis",
  "nao e possivel afirmar",
  "não é possível afirmar",
  "depends",
  "caveat",
  "limitation",
  "uncertainty",
  "provided that",
  "unless",
  "with the available information",
  "cannot conclude",
];

export function checkUnsupportedConfidence(
  input: UnsupportedConfidenceInput,
): UnsupportedConfidenceGuardResult {
  const context = buildConfidenceContext(input);

  const overconfidenceSignals = dedupe([
    ...detectUnsupportedCertainty(context),
    ...detectAbsoluteClaimsWithoutBoundary(context),
    ...detectConfidenceAgainstCouncilFindings(context),
  ]);

  const underconfidenceSignals = dedupe([
    ...detectExcessiveHedging(context),
    ...detectHedgingAgainstSufficientSupport(context),
  ]);

  const requiredCalibration = dedupe([
    ...buildOverconfidenceCalibrations(overconfidenceSignals),
    ...buildUnderconfidenceCalibrations(underconfidenceSignals),
  ]);

  return {
    passed:
      overconfidenceSignals.length === 0 &&
      underconfidenceSignals.length === 0,
    overconfidenceSignals,
    underconfidenceSignals,
    requiredCalibration,
  };
}

function buildConfidenceContext(
  input: UnsupportedConfidenceInput,
): ConfidenceContext {
  const advisorReports = input.advisorReports ?? [];
  const draft = normalize(input.draftAnswer);

  const unsupportedClaims = dedupe(
    advisorReports.flatMap((report) => report.unsupportedClaims ?? []),
  );

  const contradictions = dedupe(
    advisorReports.flatMap((report) => report.contradictions ?? []),
  );

  const missingCounterpoints = dedupe(
    advisorReports.flatMap((report) => report.missingCounterpoints ?? []),
  );

  const requiredRevisions = dedupe(
    advisorReports.flatMap((report) => report.requiredRevisions ?? []),
  );

  const evidenceRisk = normalizeRiskLevel(input.scores.evidence.level);
  const confidenceCalibrationRisk = normalizeRiskLevel(
    input.scores.confidenceCalibration.level,
  );

  const confidenceCalibrationReasons =
    input.scores.confidenceCalibration.reasons ?? [];

  const hasEvidenceRisk = isRiskAtLeast(evidenceRisk, "medium");
  const hasLogicRisk = advisorReports.some(
    (report) =>
      report.advisorId === "logical" && isRiskAtLeast(report.risk, "medium"),
  );

  const hasCompletenessRisk = advisorReports.some(
    (report) =>
      report.advisorId === "completeness" &&
      isRiskAtLeast(report.risk, "medium"),
  );

  const hasUnsupportedClaims = unsupportedClaims.length > 0;
  const hasContradictions = contradictions.length > 0;
  const hasRequiredRevisions = requiredRevisions.length > 0;

  const hasSufficientSupportSignal =
    containsAny(draft, SUPPORT_MARKERS) &&
    !hasUnsupportedClaims &&
    !hasContradictions &&
    !isRiskAtLeast(evidenceRisk, "medium") &&
    !hasReasonSignal(confidenceCalibrationReasons, [
      "overconfident",
      "unsupported",
      "certainty_without_support",
      "unsupported_confidence",
    ]);

  return {
    draft,
    evidenceRisk,
    confidenceCalibrationRisk,
    confidenceCalibrationReasons,
    unsupportedClaims,
    contradictions,
    missingCounterpoints,
    requiredRevisions,
    hasEvidenceRisk,
    hasLogicRisk,
    hasCompletenessRisk,
    hasUnsupportedClaims,
    hasContradictions,
    hasRequiredRevisions,
    hasSufficientSupportSignal,
  };
}

function detectUnsupportedCertainty(context: ConfidenceContext): string[] {
  const signals: string[] = [];
  const highConfidenceCount = countMarkerHits(
    context.draft,
    HIGH_CONFIDENCE_MARKERS,
  );

  if (highConfidenceCount === 0) {
    return signals;
  }

  if (context.hasUnsupportedClaims || context.hasEvidenceRisk) {
    signals.push("certainty_without_support");
  }

  if (context.hasContradictions) {
    signals.push("certainty_with_unresolved_contradictions");
  }

  if (context.hasLogicRisk || context.hasCompletenessRisk) {
    signals.push("certainty_with_unresolved_reasoning_risk");
  }

  if (
    hasReasonSignal(context.confidenceCalibrationReasons, [
      "overconfident",
      "unsupported_confidence",
      "certainty_without_support",
    ])
  ) {
    signals.push("certainty_flagged_by_confidence_calibration");
  }

  return signals;
}

function detectAbsoluteClaimsWithoutBoundary(
  context: ConfidenceContext,
): string[] {
  const signals: string[] = [];

  if (!containsAny(context.draft, ABSOLUTE_GENERALIZATION_MARKERS)) {
    return signals;
  }

  const hasCaveat = containsAny(context.draft, CAVEAT_MARKERS);

  if (!hasCaveat && (context.hasEvidenceRisk || context.hasUnsupportedClaims)) {
    signals.push("absolute_generalization_without_boundary");
  }

  if (!hasCaveat && context.missingCounterpoints.length > 0) {
    signals.push("absolute_claim_without_counterpoint");
  }

  return signals;
}

function detectConfidenceAgainstCouncilFindings(
  context: ConfidenceContext,
): string[] {
  const signals: string[] = [];

  const hasHighConfidence = containsAny(context.draft, HIGH_CONFIDENCE_MARKERS);

  if (!hasHighConfidence) {
    return signals;
  }

  if (context.hasRequiredRevisions) {
    signals.push("high_confidence_with_required_revisions_pending");
  }

  if (isRiskAtLeast(context.confidenceCalibrationRisk, "high")) {
    signals.push("high_confidence_conflicts_with_calibration_score");
  }

  return signals;
}

function detectExcessiveHedging(context: ConfidenceContext): string[] {
  const signals: string[] = [];
  const hedgeCount = countMarkerHits(context.draft, HEDGING_MARKERS);

  if (hedgeCount < 2) {
    return signals;
  }

  if (
    isRiskAtLeast(context.confidenceCalibrationRisk, "medium") &&
    hasReasonSignal(context.confidenceCalibrationReasons, [
      "underconfident",
      "uncertainty_pattern",
      "excessive_hedging",
    ])
  ) {
    signals.push("excessive_hedging");
  }

  if (context.hasSufficientSupportSignal && hedgeCount >= 3) {
    signals.push("excessive_hedging_despite_support");
  }

  return signals;
}

function detectHedgingAgainstSufficientSupport(
  context: ConfidenceContext,
): string[] {
  const signals: string[] = [];
  const hedgeCount = countMarkerHits(context.draft, HEDGING_MARKERS);

  if (hedgeCount === 0 || !context.hasSufficientSupportSignal) {
    return signals;
  }

  if (
    hasReasonSignal(context.confidenceCalibrationReasons, [
      "underconfident",
      "too cautious",
      "uncertainty_pattern",
    ])
  ) {
    signals.push("unnecessary_uncertainty_when_reasoning_is_sufficient");
  }

  return signals;
}

function buildOverconfidenceCalibrations(signals: readonly string[]): string[] {
  if (signals.length === 0) {
    return [];
  }

  const calibrations: string[] = [];

  if (signals.includes("certainty_without_support")) {
    calibrations.push(
      "Reduce certainty; qualify claims lacking direct support or add concrete evidence.",
    );
  }

  if (signals.includes("certainty_with_unresolved_contradictions")) {
    calibrations.push(
      "Do not use certainty while contradictions remain unresolved.",
    );
  }

  if (signals.includes("certainty_with_unresolved_reasoning_risk")) {
    calibrations.push(
      "Lower confidence until logic and completeness risks are resolved.",
    );
  }

  if (signals.includes("certainty_flagged_by_confidence_calibration")) {
    calibrations.push(
      "Follow the confidence calibration score and replace absolute language with bounded claims.",
    );
  }

  if (signals.includes("absolute_generalization_without_boundary")) {
    calibrations.push(
      "Add boundary conditions or replace absolute generalizations with limited claims.",
    );
  }

  if (signals.includes("absolute_claim_without_counterpoint")) {
    calibrations.push(
      "Add a counterpoint, exception or limitation before making an absolute claim.",
    );
  }

  if (signals.includes("high_confidence_with_required_revisions_pending")) {
    calibrations.push(
      "Do not present the answer as settled while required Council revisions remain pending.",
    );
  }

  if (signals.includes("high_confidence_conflicts_with_calibration_score")) {
    calibrations.push(
      "Align confidence language with the calibration score before delivery.",
    );
  }

  return dedupe(calibrations);
}

function buildUnderconfidenceCalibrations(signals: readonly string[]): string[] {
  if (signals.length === 0) {
    return [];
  }

  const calibrations: string[] = [];

  if (signals.includes("excessive_hedging")) {
    calibrations.push(
      "Increase assertiveness where reasoning support is sufficient; keep caveats only where they matter.",
    );
  }

  if (signals.includes("excessive_hedging_despite_support")) {
    calibrations.push(
      "Replace repeated hedging with a clear conclusion plus one concise caveat if needed.",
    );
  }

  if (signals.includes("unnecessary_uncertainty_when_reasoning_is_sufficient")) {
    calibrations.push(
      "Use a more direct conclusion because the available reasoning support is sufficient.",
    );
  }

  return dedupe(calibrations);
}

function normalize(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRiskLevel(value: CouncilRiskLevel | string): CouncilRiskLevel {
  const normalized = normalize(String(value ?? ""));

  if (
    normalized === "low" ||
    normalized === "medium" ||
    normalized === "high" ||
    normalized === "critical"
  ) {
    return normalized;
  }

  return "low";
}

function isRiskAtLeast(
  risk: CouncilRiskLevel,
  minimum: CouncilRiskLevel,
): boolean {
  return RISK_WEIGHT[risk] >= RISK_WEIGHT[minimum];
}

function containsAny(text: string, markers: readonly string[]): boolean {
  return markers.some((marker) => containsMarker(text, marker));
}

function containsMarker(text: string, marker: string): boolean {
  const normalizedMarker = normalize(marker);

  if (!text || !normalizedMarker) {
    return false;
  }

  if (normalizedMarker.includes(" ")) {
    return text.includes(normalizedMarker);
  }

  const regex = new RegExp(`\\b${escapeRegExp(normalizedMarker)}\\b`, "i");
  return regex.test(text);
}

function countMarkerHits(text: string, markers: readonly string[]): number {
  return markers.reduce(
    (count, marker) => count + (containsMarker(text, marker) ? 1 : 0),
    0,
  );
}

function hasReasonSignal(
  reasons: readonly string[],
  markers: readonly string[],
): boolean {
  const normalizedReasons = reasons.map((reason) => normalize(reason));

  return normalizedReasons.some((reason) =>
    markers.some((marker) => reason.includes(normalize(marker))),
  );
}

function dedupe(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const cleaned = String(value ?? "").trim();

    if (!cleaned || seen.has(cleaned)) {
      continue;
    }

    seen.add(cleaned);
    result.push(cleaned);
  }

  return result;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}