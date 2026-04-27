import type {
  CouncilAdvisorReport,
  CouncilInput,
  CouncilRiskLevel,
} from "../council-types";
import { scoreCompletenessRisk } from "../scoring/completeness-risk-scorer";
import {
  confidenceFromSignals,
  dedupeNormalized,
  isRiskAtLeast,
  maxRiskLevel,
  normalizeText,
} from "./advisor-utils";
import { extractProblemResolutionCouncilSignals } from "../problem-resolution-signal-reader";

type RequestedFormatId =
  | "list"
  | "table"
  | "code"
  | "json"
  | "step_by_step"
  | "prompt"
  | "concise";

interface CompletenessFinding {
  readonly id: string;
  readonly risk: CouncilRiskLevel;
  readonly message: string;
  readonly requiredRevision?: string;
  readonly optionalRevision?: string;
}

interface ReasoningCompletenessSignals {
  readonly missingVariables: string[];
  readonly missingObligations: string[];
  readonly unresolvedScenarios: string[];
  readonly violatedConstraints: string[];
  readonly unsupportedConclusions: string[];
  readonly completionObligations: string[];
  readonly closurePassed: boolean | null;
  readonly completionScore: number | null;
  readonly missingProofObligations: string[];
  readonly formalHardFailures: string[];
}

interface RequestedFormat {
  readonly id: RequestedFormatId;
  readonly requested: boolean;
  readonly satisfied: boolean;
  readonly requiredRevision?: string;
  readonly optionalRevision?: string;
}

const ADVISOR_ID = "completeness";
const ADVISOR_NAME = "Completeness Advisor";

const CONCLUSION_MARKERS = [
  "conclusao",
  "concluindo",
  "em resumo",
  "resumo final",
  "portanto",
  "assim",
  "desse modo",
  "o ponto central",
  "a resposta final",
  "final recommendation",
  "final answer",
  "therefore",
  "in conclusion",
  "in summary",
  "en conclusion",
  "en resumen",
];

const COMPLEX_TASK_MARKERS = [
  "analise",
  "avalie",
  "verifique",
  "explique",
  "resolva",
  "compare",
  "justifique",
  "demonstre",
  "desenvolva",
  "organize",
  "crie um plano",
  "passo a passo",
  "de forma ampla",
  "de forma geral",
  "detalhada",
  "detalhista",
  "integral",
  "completo",
  "com base",
  "melhore",
  "corrija",
  "implemente",
  "codex",
  "arquitetura",
  "pipeline",
];

const DIRECT_ANSWER_MARKERS = [
  "sim",
  "nao",
  "depende",
  "correto",
  "incorreto",
  "parcialmente",
  "o problema",
  "o ponto",
  "a resposta",
  "yes",
  "no",
  "it depends",
  "correct",
  "incorrect",
];

export function runCompletenessAdvisor(
  input: CouncilInput,
): CouncilAdvisorReport {
  const userInput = input.userInput ?? "";
  const draftAnswer = input.draftAnswer ?? "";

  const reasoningSignals = extractReasoningCompletenessSignals(input);
  const completenessRisk = scoreCompletenessRisk({
    missingVariables: reasoningSignals.missingVariables,
    missingObligations: reasoningSignals.missingObligations,
    unresolvedScenarios: reasoningSignals.unresolvedScenarios,
  });

  const findings = dedupeFindings([
    ...findReasoningGaps(reasoningSignals),
    ...findScoredCompletenessGaps(completenessRisk),
    ...findFormatGaps(userInput, draftAnswer),
    ...findAnswerShapeGaps(userInput, draftAnswer, reasoningSignals),
    ...findSurfaceCoverageGaps(userInput, draftAnswer),
  ]);

  const risk = maxRiskLevel([
    riskFromCompletenessScore(completenessRisk.score),
    ...findings.map((finding) => finding.risk),
  ]);

  const concerns = dedupeNormalized(findings.map((finding) => finding.id));

  const requiredRevisions = dedupeNormalized(
    findings
      .map((finding) => finding.requiredRevision)
      .filter((revision): revision is string => Boolean(revision)),
  );

  const optionalRevisions = dedupeNormalized(
    findings
      .map((finding) => finding.optionalRevision)
      .filter((revision): revision is string => Boolean(revision)),
  );

  if (risk !== "low" && requiredRevisions.length === 0) {
    requiredRevisions.push(
      "Cover the missing task parts, variables, obligations or unresolved scenarios before final delivery.",
    );
  }

  const hardSignals = findings.filter((finding) =>
    isRiskAtLeast(finding.risk, "high"),
  ).length;

  return {
    advisorId: ADVISOR_ID,
    advisorName: ADVISOR_NAME,
    passed: risk === "low",
    risk,
    concerns,
    strengths: risk === "low" ? buildStrengths(userInput, draftAnswer) : [],
    requiredRevisions,
    optionalRevisions,
    confidence: confidenceFromSignals(findings.length, hardSignals),
  };
}

function extractReasoningCompletenessSignals(
  input: CouncilInput,
): ReasoningCompletenessSignals {
  const reasoningState =
    (input.problemResolutionState as unknown) ??
    (input.reasoningState as unknown) ??
    null;
  const problemResolution = extractProblemResolutionCouncilSignals(input);

  return {
    missingVariables: mergeStringArrays(
      getNestedStringArray(reasoningState, ["closure", "missingVariables"]),
      getNestedStringArray(reasoningState, ["report", "missingVariables"]),
      getNestedStringArray(reasoningState, ["missingVariables"]),
      getNestedStringArray(reasoningState, ["unresolvedVariables"]),
      problemResolution.missingVariables,
    ),
    missingObligations: mergeStringArrays(
      getNestedStringArray(reasoningState, ["report", "missingObligations"]),
      getNestedStringArray(reasoningState, ["closure", "missingObligations"]),
      getNestedStringArray(reasoningState, ["missingObligations"]),
      problemResolution.missingObligations,
    ),
    unresolvedScenarios: mergeStringArrays(
      getNestedStringArray(reasoningState, ["closure", "unresolvedScenarios"]),
      getNestedStringArray(reasoningState, ["report", "unresolvedScenarios"]),
      getNestedStringArray(reasoningState, ["unresolvedScenarios"]),
      problemResolution.unresolvedScenarios,
    ),
    violatedConstraints: mergeStringArrays(
      getNestedStringArray(reasoningState, ["closure", "violatedConstraints"]),
      getNestedStringArray(reasoningState, ["report", "violatedConstraints"]),
      getNestedStringArray(reasoningState, ["violatedConstraints"]),
      problemResolution.violatedConstraints,
    ),
    unsupportedConclusions: mergeStringArrays(
      getNestedStringArray(reasoningState, [
        "closure",
        "unsupportedConclusions",
      ]),
      getNestedStringArray(reasoningState, [
        "report",
        "unsupportedConclusions",
      ]),
      getNestedStringArray(reasoningState, ["unsupportedConclusions"]),
      problemResolution.unsupportedConclusions,
    ),
    completionObligations: mergeStringArrays(
      getNestedStringArray(reasoningState, ["completionObligations"]),
      getNestedStringArray(reasoningState, ["report", "completionObligations"]),
    ),
    closurePassed:
      problemResolution.closurePassed ??
      getNestedBoolean(reasoningState, ["closure", "passed"]),
    completionScore:
      problemResolution.completionScore ??
      getNestedNumber(reasoningState, ["closure", "completionScore"]),
    missingProofObligations: problemResolution.missingProofObligations,
    formalHardFailures: problemResolution.hardFailureReasons,
  };
}

function findReasoningGaps(
  signals: ReasoningCompletenessSignals,
): CompletenessFinding[] {
  const findings: CompletenessFinding[] = [];

  if (signals.closurePassed === false) {
    findings.push({
      id: "reasoning_closure_failed",
      risk: "high",
      message:
        "The upstream reasoning closure did not pass, so the answer may be incomplete.",
      requiredRevision:
        "Resolve the pending reasoning closure issues before allowing the response to proceed.",
    });
  }

  if (signals.missingVariables.length > 0) {
    findings.push({
      id: "missing_variables",
      risk: "high",
      message:
        "The reasoning state reports variables that were not addressed in the draft.",
      requiredRevision:
        "Address every unresolved variable identified by the reasoning layer.",
    });
  }

  if (signals.missingObligations.length > 0) {
    findings.push({
      id: "missing_obligations",
      risk: "high",
      message:
        "The reasoning state reports task obligations that were not fulfilled.",
      requiredRevision:
        "Fulfill all missing obligations from the task contract or problem-resolution state.",
    });
  }

  if (signals.unresolvedScenarios.length > 0) {
    findings.push({
      id: "unresolved_scenarios",
      risk: "high",
      message:
        "The reasoning state reports scenarios that were not resolved.",
      requiredRevision:
        "Resolve all relevant scenarios or explicitly state why a scenario cannot be resolved.",
    });
  }

  if (signals.violatedConstraints.length > 0) {
    findings.push({
      id: "violated_constraints",
      risk: "critical",
      message:
        "The response appears to violate one or more constraints from the original task.",
      requiredRevision:
        "Revise the answer so that it preserves every mandatory constraint from the user request.",
    });
  }

  if (signals.unsupportedConclusions.length > 0) {
    findings.push({
      id: "unsupported_conclusions",
      risk: "high",
      message:
        "The reasoning state reports conclusions that are not sufficiently supported.",
      requiredRevision:
        "Either justify the unsupported conclusions or rewrite them as hypotheses, limits or caveats.",
    });
  }

  if (signals.missingProofObligations.length > 0) {
    findings.push({
      id: "missing_proof_obligations",
      risk: "high",
      message:
        "The reasoning state reports proof obligations that were not fulfilled.",
      requiredRevision:
        "Fulfill the missing proof obligations before final delivery.",
    });
  }

  if (signals.formalHardFailures.length > 0) {
    findings.push({
      id: "formal_problem_resolution_failure",
      risk: signals.violatedConstraints.length > 0 ? "critical" : "high",
      message:
        "Formal problem-resolution diagnostics indicate incomplete or invalid reasoning.",
      requiredRevision:
        "Resolve the formal problem-resolution diagnostics before delivery.",
    });
  }

  if (
    typeof signals.completionScore === "number" &&
    signals.completionScore < 0.72
  ) {
    findings.push({
      id: "low_reasoning_completion_score",
      risk: signals.completionScore < 0.5 ? "high" : "medium",
      message:
        "The upstream reasoning completion score is below the expected threshold.",
      requiredRevision:
        "Increase coverage of the task until the reasoning completion score is acceptable.",
    });
  }

  return findings;
}

function findScoredCompletenessGaps(completenessRisk: {
  readonly score: number;
  readonly concerns: readonly string[];
}): CompletenessFinding[] {
  const risk = riskFromCompletenessScore(completenessRisk.score);

  return completenessRisk.concerns.map((concern) => ({
    id: concern,
    risk,
    message: `Completeness scorer concern detected: ${concern}.`,
    requiredRevision: isRiskAtLeast(risk, "medium")
      ? "Cover missing variables, obligations and unresolved scenarios before final delivery."
      : undefined,
  }));
}

function findFormatGaps(
  userInput: string,
  draftAnswer: string,
): CompletenessFinding[] {
  return detectRequestedFormats(userInput, draftAnswer)
    .filter((format) => format.requested && !format.satisfied)
    .map((format) => ({
      id: `requested_format_not_satisfied:${format.id}`,
      risk: format.id === "code" || format.id === "json" ? "high" : "medium",
      message: `The user requested ${format.id} format, but the draft does not appear to satisfy it.`,
      requiredRevision: format.requiredRevision,
      optionalRevision: format.optionalRevision,
    }));
}

function findAnswerShapeGaps(
  userInput: string,
  draftAnswer: string,
  reasoningSignals: ReasoningCompletenessSignals,
): CompletenessFinding[] {
  const findings: CompletenessFinding[] = [];
  const normalizedDraft = normalizeText(draftAnswer);
  const draftWordCount = wordCount(draftAnswer);

  if (!normalizedDraft || draftWordCount < 3) {
    findings.push({
      id: "empty_or_near_empty_answer",
      risk: "critical",
      message:
        "The draft is empty or too short to satisfy the user's request.",
      requiredRevision:
        "Provide a substantive answer that directly addresses the user's request.",
    });

    return findings;
  }

  if (
    shouldRequireExplicitConclusion(userInput, draftAnswer, reasoningSignals) &&
    !hasExplicitConclusion(draftAnswer)
  ) {
    findings.push({
      id: "missing_explicit_conclusion",
      risk: "high",
      message:
        "The draft does not include an explicit conclusion even though the task requires closure.",
      requiredRevision:
        "Add an explicit conclusion that resolves the full user request and does not leave the central issue open.",
    });
  }

  if (looksLikeDirectQuestion(userInput) && !hasDirectAnswerEarly(draftAnswer)) {
    findings.push({
      id: "missing_direct_answer",
      risk: "medium",
      message:
        "The user asked a direct question, but the draft does not answer directly near the beginning.",
      requiredRevision:
        "Begin with a direct answer, then provide the explanation or qualifications.",
    });
  }

  if (isTooBriefForTask(userInput, draftAnswer, reasoningSignals)) {
    findings.push({
      id: "answer_too_brief_for_multi_constraint_task",
      risk: "medium",
      message:
        "The answer appears too brief for a multi-constraint or complex task.",
      optionalRevision:
        "Expand the answer enough to cover all requested parts, constraints, scenarios and conclusions.",
    });
  }

  if (hasPrematureClosureLanguage(draftAnswer, reasoningSignals)) {
    findings.push({
      id: "premature_closure_signal",
      risk: "medium",
      message:
        "The draft uses closure language while upstream reasoning still reports unresolved elements.",
      requiredRevision:
        "Do not claim the issue is resolved until all variables, scenarios and obligations have been addressed.",
    });
  }

  return findings;
}

function findSurfaceCoverageGaps(
  userInput: string,
  draftAnswer: string,
): CompletenessFinding[] {
  const salientTerms = extractSalientTerms(userInput);
  const normalizedDraft = normalizeText(draftAnswer);

  if (salientTerms.length < 5 || wordCount(draftAnswer) < 80) {
    return [];
  }

  const missingTerms = salientTerms.filter(
    (term) => !normalizedDraft.includes(normalizeText(term)),
  );

  const missingRatio = missingTerms.length / Math.max(1, salientTerms.length);

  if (missingRatio < 0.55) {
    return [];
  }

  return [
    {
      id: "potential_surface_coverage_gap",
      risk: "medium",
      message:
        "Many salient terms from the request do not appear in the draft. This may indicate incomplete coverage.",
      optionalRevision:
        "Review whether the answer covered the main entities and requirements from the user's request, even when using synonyms.",
    },
  ];
}

function detectRequestedFormats(
  userInput: string,
  draftAnswer: string,
): RequestedFormat[] {
  const normalizedUser = normalizeText(userInput);
  const rawDraft = String(draftAnswer ?? "");
  const normalizedDraft = normalizeText(draftAnswer);

  return [
    {
      id: "list",
      requested:
        /\b(lista|list|bullet|bullets|topicos|itens|items|em pontos|enumere)\b/.test(
          normalizedUser,
        ),
      satisfied: /(^|\n)\s*(?:[-*•]|\d+[.)])\s+\S+/m.test(rawDraft),
      requiredRevision:
        "Use a list, bullets or numbered items as requested by the user.",
    },
    {
      id: "table",
      requested: /\b(tabela|quadro|table|colunas|columns)\b/.test(
        normalizedUser,
      ),
      satisfied:
        /\|.+\|/.test(rawDraft) ||
        /<table[\s>]/i.test(rawDraft) ||
        /\t/.test(rawDraft),
      requiredRevision:
        "Use a table or clearly separated columns as requested by the user.",
    },
    {
      id: "code",
      requested:
        /\b(codigo|code|typescript|javascript|python|funcao|function|classe|class|interface|arquivo|substitua o conteudo)\b/.test(
          normalizedUser,
        ),
      satisfied:
        /```[\s\S]+```/.test(rawDraft) ||
        /\b(export|import|function|const|interface|type|class)\b/.test(
          rawDraft,
        ),
      requiredRevision:
        "Provide the requested code in a complete, copy-ready format.",
    },
    {
      id: "json",
      requested: /\bjson\b/.test(normalizedUser),
      satisfied:
        /```json[\s\S]+```/i.test(rawDraft) ||
        /^\s*[{[][\s\S]*[}\]]\s*$/.test(rawDraft),
      requiredRevision:
        "Return valid JSON or a clearly fenced JSON block as requested.",
    },
    {
      id: "step_by_step",
      requested:
        /\b(passo a passo|etapas|por etapas|step by step|steps)\b/.test(
          normalizedUser,
        ),
      satisfied:
        /\b(passo|etapa|step)\s*\d+/i.test(rawDraft) ||
        /(^|\n)\s*\d+[.)]\s+\S+/m.test(rawDraft),
      requiredRevision:
        "Organize the response as a sequence of steps.",
    },
    {
      id: "prompt",
      requested: /\b(prompt|codex)\b/.test(normalizedUser),
      satisfied:
        normalizedDraft.includes("voce deve") ||
        normalizedDraft.includes("you must") ||
        rawDraft.includes("```text") ||
        rawDraft.includes("```"),
      requiredRevision:
        "Provide the requested prompt in a clear, reusable and copy-ready form.",
    },
    {
      id: "concise",
      requested:
        /\b(resumido|breve|curto|objetivo|conciso|simplificado|sem alongar)\b/.test(
          normalizedUser,
        ),
      satisfied: wordCount(draftAnswer) <= 260,
      optionalRevision:
        "Condense the response to match the user's request for brevity.",
    },
  ];
}

function shouldRequireExplicitConclusion(
  userInput: string,
  draftAnswer: string,
  reasoningSignals: ReasoningCompletenessSignals,
): boolean {
  const normalizedUser = normalizeText(userInput);

  const userAskedForOnlyCode =
    /\b(codigo|code|typescript|javascript|python|arquivo|substitua o conteudo)\b/.test(
      normalizedUser,
    ) && !/\b(explique|justifique|analise|avalie)\b/.test(normalizedUser);

  if (userAskedForOnlyCode && /```[\s\S]+```/.test(draftAnswer)) {
    return false;
  }

  const hasReasoningPressure =
    reasoningSignals.completionObligations.length > 0 ||
    reasoningSignals.unresolvedScenarios.length > 0 ||
    reasoningSignals.missingVariables.length > 0 ||
    reasoningSignals.missingObligations.length > 0;

  const userAskedComplexTask = COMPLEX_TASK_MARKERS.some((marker) =>
    normalizedUser.includes(normalizeText(marker)),
  );

  return userAskedComplexTask || hasReasoningPressure || wordCount(draftAnswer) > 180;
}

function hasExplicitConclusion(draftAnswer: string): boolean {
  const normalizedDraft = normalizeText(draftAnswer);

  return CONCLUSION_MARKERS.some((marker) =>
    normalizedDraft.includes(normalizeText(marker)),
  );
}

function looksLikeDirectQuestion(userInput: string): boolean {
  const normalized = normalizeText(userInput);

  if (userInput.includes("?")) {
    return true;
  }

  return /\b(o que|qual|quais|como|por que|porque|voce acha|esta certo|esta errado|faz sentido|what|why|how|which)\b/.test(
    normalized,
  );
}

function hasDirectAnswerEarly(draftAnswer: string): boolean {
  const firstChunk = normalizeText(draftAnswer).slice(0, 320);

  return DIRECT_ANSWER_MARKERS.some((marker) =>
    firstChunk.includes(normalizeText(marker)),
  );
}

function isTooBriefForTask(
  userInput: string,
  draftAnswer: string,
  reasoningSignals: ReasoningCompletenessSignals,
): boolean {
  const userWords = wordCount(userInput);
  const draftWords = wordCount(draftAnswer);
  const normalizedUser = normalizeText(userInput);

  const userRequestsDepth =
    COMPLEX_TASK_MARKERS.some((marker) =>
      normalizedUser.includes(normalizeText(marker)),
    ) || userWords > 80;

  const reasoningHasMultipleParts =
    reasoningSignals.completionObligations.length >= 2 ||
    reasoningSignals.missingVariables.length >= 2 ||
    reasoningSignals.unresolvedScenarios.length >= 2;

  return (userRequestsDepth || reasoningHasMultipleParts) && draftWords < 90;
}

function hasPrematureClosureLanguage(
  draftAnswer: string,
  reasoningSignals: ReasoningCompletenessSignals,
): boolean {
  const hasUnresolvedReasoning =
    reasoningSignals.missingVariables.length > 0 ||
    reasoningSignals.missingObligations.length > 0 ||
    reasoningSignals.unresolvedScenarios.length > 0 ||
    reasoningSignals.closurePassed === false;

  if (!hasUnresolvedReasoning) {
    return false;
  }

  const normalizedDraft = normalizeText(draftAnswer);

  return [
    "assim esta resolvido",
    "problema resolvido",
    "com isso basta",
    "isso conclui",
    "therefore this solves",
    "this fully answers",
  ].some((marker) => normalizedDraft.includes(normalizeText(marker)));
}

function riskFromCompletenessScore(score: number): CouncilRiskLevel {
  if (score >= 0.8) return "critical";
  if (score >= 0.58) return "high";
  if (score >= 0.3) return "medium";
  return "low";
}

function buildStrengths(userInput: string, draftAnswer: string): string[] {
  const strengths = ["All major task parts appear covered."];

  if (hasExplicitConclusion(draftAnswer)) {
    strengths.push("The draft includes an explicit conclusion.");
  }

  if (detectRequestedFormats(userInput, draftAnswer).every(
    (format) => !format.requested || format.satisfied,
  )) {
    strengths.push("Requested response format appears satisfied.");
  }

  return dedupeNormalized(strengths);
}

function dedupeFindings(
  findings: readonly CompletenessFinding[],
): CompletenessFinding[] {
  const byId = new Map<string, CompletenessFinding>();

  for (const finding of findings) {
    const previous = byId.get(finding.id);

    if (!previous) {
      byId.set(finding.id, finding);
      continue;
    }

    byId.set(finding.id, {
      ...previous,
      risk: maxRiskLevel([previous.risk, finding.risk]),
      requiredRevision:
        previous.requiredRevision ?? finding.requiredRevision,
      optionalRevision:
        previous.optionalRevision ?? finding.optionalRevision,
    });
  }

  return Array.from(byId.values());
}

function extractSalientTerms(text: string): string[] {
  const stopwords = new Set([
    "para",
    "como",
    "isso",
    "essa",
    "esse",
    "aqui",
    "agora",
    "sobre",
    "mais",
    "menos",
    "muito",
    "pouco",
    "voce",
    "preciso",
    "quero",
    "fazer",
    "criar",
    "dizer",
    "the",
    "and",
    "that",
    "this",
    "with",
    "from",
    "your",
    "need",
    "want",
  ]);

  return dedupeNormalized(
    normalizeText(text)
      .split(/\s+/g)
      .map((term) => term.trim())
      .filter((term) => term.length >= 5 && !stopwords.has(term)),
  ).slice(0, 24);
}

function wordCount(text: string): number {
  return normalizeText(text)
    .split(/\s+/g)
    .map((token) => token.trim())
    .filter(Boolean).length;
}

function mergeStringArrays(...values: ReadonlyArray<readonly string[]>): string[] {
  return dedupeNormalized(values.flatMap((value) => value));
}

function getNestedStringArray(
  source: unknown,
  path: readonly string[],
): string[] {
  const value = getNestedValue(source, path);

  if (!Array.isArray(value)) {
    return [];
  }

  return dedupeNormalized(
    value
      .map((entry) => String(entry ?? "").trim())
      .filter(Boolean),
  );
}

function getNestedBoolean(
  source: unknown,
  path: readonly string[],
): boolean | null {
  const value = getNestedValue(source, path);

  return typeof value === "boolean" ? value : null;
}

function getNestedNumber(
  source: unknown,
  path: readonly string[],
): number | null {
  const value = getNestedValue(source, path);

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getNestedValue(source: unknown, path: readonly string[]): unknown {
  let current: unknown = source;

  for (const segment of path) {
    if (!isRecord(current)) {
      return undefined;
    }

    current = current[segment];
  }

  return current;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
