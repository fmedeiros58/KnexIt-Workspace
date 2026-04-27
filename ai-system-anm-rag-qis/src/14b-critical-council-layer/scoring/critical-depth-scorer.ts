import type {
  CouncilAdvisorReport,
  CouncilRiskLevel,
  CouncilScoreResult,
} from "../council-types";

interface CriticalDepthInput {
  readonly advisorReports: CouncilAdvisorReport[];
  readonly draftAnswer: string;
  readonly userInput?: string;
}

interface CriticalDepthContext {
  readonly userInput: string;
  readonly draftAnswer: string;
  readonly normalizedUser: string;
  readonly normalizedDraft: string;
  readonly advisorReports: CouncilAdvisorReport[];
  readonly concerns: string[];
  readonly requiredRevisions: string[];
  readonly missingCounterpoints: string[];
  readonly unsupportedClaims: string[];
  readonly overAgreementSignals: string[];
  readonly contradictions: string[];
  readonly hasMaterialAdvisorRisk: boolean;
  readonly criticalDepthRequired: boolean;
  readonly hasCounterpoint: boolean;
  readonly hasCounterexample: boolean;
  readonly hasPremiseTest: boolean;
  readonly hasAlternativeHypothesis: boolean;
  readonly hasEvidenceSeparation: boolean;
  readonly hasLimitOrCaveat: boolean;
  readonly hasConcreteWeakness: boolean;
  readonly hasActionableImprovement: boolean;
  readonly hasCriteriaLanguage: boolean;
  readonly hasOnlyValidationTone: boolean;
  readonly hasConclusion: boolean;
}

interface CriticalDepthPenalty {
  readonly reason: string;
  readonly penalty: number;
  readonly minimumRisk?: CouncilRiskLevel;
}

const RISK_WEIGHT: Record<CouncilRiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

const COUNTERPOINT_MARKERS = [
  "porem",
  "porém",
  "mas",
  "no entanto",
  "contudo",
  "por outro lado",
  "contraponto",
  "contraargumento",
  "objeção",
  "objecao",
  "ressalva",
  "limite",
  "limitação",
  "limitacao",
  "however",
  "but",
  "on the other hand",
  "counterpoint",
  "counterargument",
  "objection",
  "limitation",
  "caveat",
];

const COUNTEREXAMPLE_MARKERS = [
  "contraexemplo",
  "excecao",
  "exceção",
  "caso em que falha",
  "isso falha quando",
  "nem sempre",
  "counterexample",
  "exception",
  "case where it fails",
  "does not always",
];

const PREMISE_TEST_MARKERS = [
  "testar a premissa",
  "validar a premissa",
  "avaliar a premissa",
  "a premissa precisa",
  "premissa fragil",
  "premissa frágil",
  "antes de concordar",
  "nao da para assumir",
  "não dá para assumir",
  "hipotese concorrente",
  "hipótese concorrente",
  "premise test",
  "test the premise",
  "validate the premise",
  "premise validation",
  "stress test",
  "cannot assume",
  "competing hypothesis",
];

const ALTERNATIVE_HYPOTHESIS_MARKERS = [
  "hipotese alternativa",
  "hipótese alternativa",
  "outra possibilidade",
  "outra interpretacao",
  "outra interpretação",
  "explicacao alternativa",
  "explicação alternativa",
  "cenario alternativo",
  "cenário alternativo",
  "tambem pode ser",
  "também pode ser",
  "alternative hypothesis",
  "another possibility",
  "alternative interpretation",
  "alternative explanation",
  "alternative scenario",
];

const EVIDENCE_SEPARATION_MARKERS = [
  "evidencia",
  "evidência",
  "inferencia",
  "inferência",
  "hipotese",
  "hipótese",
  "opiniao",
  "opinião",
  "dados",
  "fonte",
  "prova",
  "o que sabemos",
  "o que se pode inferir",
  "o que ainda e incerto",
  "o que ainda é incerto",
  "evidence",
  "inference",
  "hypothesis",
  "opinion",
  "data",
  "source",
  "proof",
  "what we know",
  "what can be inferred",
  "what remains uncertain",
];

const LIMIT_MARKERS = [
  "limite",
  "limitação",
  "limitacao",
  "ressalva",
  "incerteza",
  "depende",
  "condicao",
  "condição",
  "com os dados disponiveis",
  "com os dados disponíveis",
  "nao e possivel afirmar",
  "não é possível afirmar",
  "limitation",
  "caveat",
  "uncertainty",
  "depends",
  "condition",
  "with the available information",
  "cannot conclude",
];

const WEAKNESS_MARKERS = [
  "problema",
  "falha",
  "fragil",
  "frágil",
  "fraqueza",
  "incompleto",
  "insuficiente",
  "risco",
  "ponto fraco",
  "precisa melhorar",
  "problem",
  "failure",
  "weak",
  "weakness",
  "incomplete",
  "insufficient",
  "risk",
  "needs improvement",
];

const ACTIONABLE_MARKERS = [
  "adicione",
  "remova",
  "reescreva",
  "corrija",
  "ajuste",
  "explique",
  "justifique",
  "compare",
  "teste",
  "valide",
  "substitua",
  "separe",
  "inclua",
  "add",
  "remove",
  "rewrite",
  "correct",
  "fix",
  "adjust",
  "explain",
  "justify",
  "compare",
  "test",
  "validate",
  "replace",
  "separate",
  "include",
];

const CRITERIA_MARKERS = [
  "criterio",
  "critério",
  "critérios",
  "criterios",
  "porque",
  "pois",
  "com base",
  "a partir",
  "evidencia",
  "evidência",
  "justificativa",
  "fundamento",
  "criteria",
  "criterion",
  "because",
  "based on",
  "evidence",
  "justification",
  "rationale",
];

const VALIDATION_TONE_MARKERS = [
  "esta excelente",
  "está excelente",
  "ficou excelente",
  "esta perfeito",
  "está perfeito",
  "perfeito",
  "concordo totalmente",
  "voce esta certo",
  "você está certo",
  "voce tem razao",
  "você tem razão",
  "excellent",
  "perfect",
  "i completely agree",
  "you are right",
  "great point",
];

const CONCLUSION_MARKERS = [
  "conclusao",
  "conclusão",
  "concluindo",
  "em resumo",
  "portanto",
  "logo",
  "assim",
  "o ponto central",
  "a resposta",
  "therefore",
  "thus",
  "in conclusion",
  "in summary",
  "the answer",
];

const EVALUATION_REQUEST_MARKERS = [
  "avalie",
  "analise",
  "verifique",
  "o que voce acha",
  "o que você acha",
  "esta bom",
  "está bom",
  "esta ruim",
  "está ruim",
  "esta certo",
  "está certo",
  "esta errado",
  "está errado",
  "faz sentido",
  "minha ideia",
  "meu texto",
  "essa resposta",
  "evaluate",
  "analyze",
  "verify",
  "what do you think",
  "is it good",
  "is this right",
  "does it make sense",
];

const HIGH_STAKES_MARKERS = [
  "legal",
  "juridico",
  "jurídico",
  "lei",
  "norma",
  "edital",
  "medico",
  "médico",
  "saude",
  "saúde",
  "financeiro",
  "seguranca",
  "segurança",
  "codigo",
  "código",
  "producao",
  "produção",
  "arquitetura",
  "medical",
  "health",
  "financial",
  "security",
  "code",
  "production",
  "architecture",
];

export function scoreCriticalDepth(
  input: CriticalDepthInput,
): CouncilScoreResult {
  const context = buildCriticalDepthContext(input);

  const penalties = dedupePenalties([
    ...checkCounterpointDepth(context),
    ...checkPremiseTestingDepth(context),
    ...checkEvidenceDepth(context),
    ...checkEvaluationDepth(context),
    ...checkAntiSycophancyDepth(context),
    ...checkConclusionDepth(context),
  ]);

  const totalPenalty = clamp(
    penalties.reduce((sum, penalty) => sum + penalty.penalty, 0),
    0,
    1,
  );

  const score = round(clamp(1 - totalPenalty, 0, 1), 3);
  const scoreLevel = scoreToRiskLevel(score);
  const minimumRisk = penalties.reduce<CouncilRiskLevel>(
    (highest, penalty) =>
      penalty.minimumRisk ? maxRisk(highest, penalty.minimumRisk) : highest,
    "low",
  );

  const level = maxRisk(scoreLevel, minimumRisk);

  return {
    score,
    level,
    reasons: penalties.map((penalty) => penalty.reason),
  };
}

function buildCriticalDepthContext(input: CriticalDepthInput): CriticalDepthContext {
  const userInput = input.userInput ?? "";
  const draftAnswer = input.draftAnswer ?? "";
  const advisorReports = input.advisorReports ?? [];
  const normalizedUser = normalizeText(userInput);
  const normalizedDraft = normalizeText(draftAnswer);

  const concerns = dedupe(
    advisorReports.flatMap((report) => report.concerns ?? []),
  );
  const requiredRevisions = dedupe(
    advisorReports.flatMap((report) => report.requiredRevisions ?? []),
  );
  const missingCounterpoints = dedupe(
    advisorReports.flatMap((report) => report.missingCounterpoints ?? []),
  );
  const unsupportedClaims = dedupe(
    advisorReports.flatMap((report) => report.unsupportedClaims ?? []),
  );
  const overAgreementSignals = dedupe(
    advisorReports.flatMap((report) => report.overAgreementSignals ?? []),
  );
  const contradictions = dedupe(
    advisorReports.flatMap((report) => report.contradictions ?? []),
  );

  const hasMaterialAdvisorRisk = advisorReports.some((report) =>
    isRiskAtLeast(report.risk, "medium"),
  );

  const criticalDepthRequired =
    hasMaterialAdvisorRisk ||
    missingCounterpoints.length > 0 ||
    unsupportedClaims.length > 0 ||
    overAgreementSignals.length > 0 ||
    contradictions.length > 0 ||
    containsAny(normalizedUser, EVALUATION_REQUEST_MARKERS) ||
    containsAny(normalizedUser, HIGH_STAKES_MARKERS);

  const hasCounterpoint = containsAny(normalizedDraft, COUNTERPOINT_MARKERS);
  const hasCounterexample = containsAny(normalizedDraft, COUNTEREXAMPLE_MARKERS);
  const hasPremiseTest = containsAny(normalizedDraft, PREMISE_TEST_MARKERS);
  const hasAlternativeHypothesis = containsAny(
    normalizedDraft,
    ALTERNATIVE_HYPOTHESIS_MARKERS,
  );
  const hasEvidenceSeparation = containsAny(
    normalizedDraft,
    EVIDENCE_SEPARATION_MARKERS,
  );
  const hasLimitOrCaveat = containsAny(normalizedDraft, LIMIT_MARKERS);
  const hasConcreteWeakness = containsAny(normalizedDraft, WEAKNESS_MARKERS);
  const hasActionableImprovement = containsAny(normalizedDraft, ACTIONABLE_MARKERS);
  const hasCriteriaLanguage = containsAny(normalizedDraft, CRITERIA_MARKERS);
  const hasOnlyValidationTone =
    containsAny(normalizedDraft, VALIDATION_TONE_MARKERS) &&
    !hasConcreteWeakness &&
    !hasCounterpoint &&
    !hasPremiseTest;
  const hasConclusion = containsAny(normalizedDraft, CONCLUSION_MARKERS);

  return {
    userInput,
    draftAnswer,
    normalizedUser,
    normalizedDraft,
    advisorReports,
    concerns,
    requiredRevisions,
    missingCounterpoints,
    unsupportedClaims,
    overAgreementSignals,
    contradictions,
    hasMaterialAdvisorRisk,
    criticalDepthRequired,
    hasCounterpoint,
    hasCounterexample,
    hasPremiseTest,
    hasAlternativeHypothesis,
    hasEvidenceSeparation,
    hasLimitOrCaveat,
    hasConcreteWeakness,
    hasActionableImprovement,
    hasCriteriaLanguage,
    hasOnlyValidationTone,
    hasConclusion,
  };
}

function checkCounterpointDepth(
  context: CriticalDepthContext,
): CriticalDepthPenalty[] {
  const penalties: CriticalDepthPenalty[] = [];

  if (!context.criticalDepthRequired) {
    return penalties;
  }

  if (!context.hasCounterpoint && !context.hasAlternativeHypothesis) {
    penalties.push({
      reason: "missing_counterpoint",
      penalty: 0.22,
      minimumRisk: "medium",
    });
  }

  if (
    context.missingCounterpoints.length > 0 &&
    !context.hasCounterexample &&
    !context.hasAlternativeHypothesis
  ) {
    penalties.push({
      reason: "missing_counterexample_or_alternative_case",
      penalty: 0.18,
      minimumRisk: "medium",
    });
  }

  return penalties;
}

function checkPremiseTestingDepth(
  context: CriticalDepthContext,
): CriticalDepthPenalty[] {
  const penalties: CriticalDepthPenalty[] = [];

  const premiseRelatedConcern = hasConcernLike(context, [
    "premise",
    "premissa",
    "agreement",
    "over_agreement",
    "unconditional_agreement",
    "sycophancy",
    "bajulacao",
    "bajulação",
  ]);

  if ((context.criticalDepthRequired || premiseRelatedConcern) && !context.hasPremiseTest) {
    penalties.push({
      reason: "premise_not_stress_tested",
      penalty: 0.2,
      minimumRisk: premiseRelatedConcern ? "high" : "medium",
    });
  }

  if (
    premiseRelatedConcern &&
    !context.hasAlternativeHypothesis &&
    !context.hasCounterpoint
  ) {
    penalties.push({
      reason: "user_premise_not_challenged_with_alternative",
      penalty: 0.18,
      minimumRisk: "medium",
    });
  }

  return penalties;
}

function checkEvidenceDepth(
  context: CriticalDepthContext,
): CriticalDepthPenalty[] {
  const penalties: CriticalDepthPenalty[] = [];

  const evidenceRelatedConcern =
    context.unsupportedClaims.length > 0 ||
    hasConcernLike(context, [
      "evidence",
      "evidencia",
      "evidência",
      "unsupported",
      "source",
      "fonte",
      "claim",
      "confidence",
      "certeza",
    ]);

  if (evidenceRelatedConcern && !context.hasEvidenceSeparation) {
    penalties.push({
      reason: "evidence_inference_not_distinguished",
      penalty: 0.22,
      minimumRisk: "high",
    });
  }

  if (
    evidenceRelatedConcern &&
    !context.hasLimitOrCaveat &&
    !context.hasCriteriaLanguage
  ) {
    penalties.push({
      reason: "evidence_limits_not_marked",
      penalty: 0.14,
      minimumRisk: "medium",
    });
  }

  return penalties;
}

function checkEvaluationDepth(
  context: CriticalDepthContext,
): CriticalDepthPenalty[] {
  const penalties: CriticalDepthPenalty[] = [];
  const userAskedEvaluation = containsAny(
    context.normalizedUser,
    EVALUATION_REQUEST_MARKERS,
  );

  if (!userAskedEvaluation) {
    return penalties;
  }

  if (!context.hasConcreteWeakness) {
    penalties.push({
      reason: "evaluation_without_concrete_weakness",
      penalty: 0.16,
      minimumRisk: "medium",
    });
  }

  if (!context.hasActionableImprovement) {
    penalties.push({
      reason: "evaluation_without_actionable_improvement",
      penalty: 0.16,
      minimumRisk: "medium",
    });
  }

  if (!context.hasCriteriaLanguage) {
    penalties.push({
      reason: "evaluation_without_criteria",
      penalty: 0.12,
    });
  }

  return penalties;
}

function checkAntiSycophancyDepth(
  context: CriticalDepthContext,
): CriticalDepthPenalty[] {
  const penalties: CriticalDepthPenalty[] = [];

  if (context.overAgreementSignals.length > 0) {
    penalties.push({
      reason: "over_agreement_reduces_critical_depth",
      penalty: 0.24,
      minimumRisk: "high",
    });
  }

  if (context.hasOnlyValidationTone) {
    penalties.push({
      reason: "validation_tone_without_independent_critique",
      penalty: 0.2,
      minimumRisk: "medium",
    });
  }

  return penalties;
}

function checkConclusionDepth(
  context: CriticalDepthContext,
): CriticalDepthPenalty[] {
  const penalties: CriticalDepthPenalty[] = [];

  if (
    context.criticalDepthRequired &&
    wordCount(context.draftAnswer) > 100 &&
    !context.hasConclusion
  ) {
    penalties.push({
      reason: "critical_analysis_without_clear_conclusion",
      penalty: 0.12,
    });
  }

  if (
    context.contradictions.length > 0 &&
    !containsAny(context.normalizedDraft, [
      "corrigir a contradicao",
      "corrigir a contradição",
      "resolver a contradicao",
      "resolver a contradição",
      "resolve the contradiction",
    ])
  ) {
    penalties.push({
      reason: "contradiction_not_explicitly_resolved",
      penalty: 0.24,
      minimumRisk: "high",
    });
  }

  return penalties;
}

function hasConcernLike(
  context: CriticalDepthContext,
  fragments: readonly string[],
): boolean {
  const joined = normalizeText(
    [
      ...context.concerns,
      ...context.requiredRevisions,
      ...context.missingCounterpoints,
      ...context.unsupportedClaims,
      ...context.overAgreementSignals,
      ...context.contradictions,
    ].join(" "),
  );

  return fragments.some((fragment) =>
    joined.includes(normalizeText(fragment)),
  );
}

function scoreToRiskLevel(score: number): CouncilRiskLevel {
  if (score <= 0.25) return "critical";
  if (score <= 0.45) return "high";
  if (score <= 0.7) return "medium";
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

function containsAny(text: string, markers: readonly string[]): boolean {
  return markers.some((marker) => containsMarker(text, marker));
}

function containsMarker(text: string, marker: string): boolean {
  const normalizedMarker = normalizeText(marker);

  if (!text || !normalizedMarker) {
    return false;
  }

  if (normalizedMarker.includes(" ")) {
    return text.includes(normalizedMarker);
  }

  const regex = new RegExp(`\\b${escapeRegExp(normalizedMarker)}\\b`, "i");
  return regex.test(text);
}

function dedupePenalties(
  penalties: readonly CriticalDepthPenalty[],
): CriticalDepthPenalty[] {
  const byReason = new Map<string, CriticalDepthPenalty>();

  for (const penalty of penalties) {
    const key = normalizeText(penalty.reason);
    const previous = byReason.get(key);

    if (!previous) {
      byReason.set(key, penalty);
      continue;
    }

    byReason.set(key, {
      reason: previous.reason,
      penalty: Math.max(previous.penalty, penalty.penalty),
      minimumRisk: penalty.minimumRisk
        ? maxRisk(previous.minimumRisk ?? "low", penalty.minimumRisk)
        : previous.minimumRisk,
    });
  }

  return Array.from(byReason.values());
}

function dedupe(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const cleaned = String(value ?? "").trim();
    const key = normalizeText(cleaned);

    if (!cleaned || !key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

function normalizeText(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(text: string): number {
  return normalizeText(text)
    .split(/\s+/g)
    .map((token) => token.trim())
    .filter(Boolean).length;
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