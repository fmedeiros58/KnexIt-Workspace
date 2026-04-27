import type {
  CouncilAdvisorReport,
  CouncilInput,
  CouncilRiskLevel,
  CouncilScoreResult,
} from "../council-types";

interface UserBenefitInput {
  readonly councilInput: CouncilInput;
  readonly advisorReports: CouncilAdvisorReport[];
}

interface UserBenefitContext {
  readonly userInput: string;
  readonly draftAnswer: string;
  readonly normalizedUser: string;
  readonly normalizedDraft: string;
  readonly userWordCount: number;
  readonly draftWordCount: number;

  readonly advisorReports: CouncilAdvisorReport[];
  readonly advisorConcerns: string[];
  readonly advisorRequiredRevisions: string[];
  readonly advisorUnsupportedClaims: string[];
  readonly advisorContradictions: string[];
  readonly advisorMissingCounterpoints: string[];
  readonly advisorOverAgreementSignals: string[];

  readonly highImpact: boolean;
  readonly userRequestsDecision: boolean;
  readonly userRequestsAction: boolean;
  readonly userRequestsEvaluation: boolean;
  readonly userRequestsImplementation: boolean;
  readonly userRequestsCode: boolean;
  readonly userRequestsPrompt: boolean;
  readonly userShowsStrongPremise: boolean;

  readonly draftHasPleaserTone: boolean;
  readonly draftHasRiskAwareness: boolean;
  readonly draftHasTradeoffAwareness: boolean;
  readonly draftHasCaveats: boolean;
  readonly draftHasRecommendation: boolean;
  readonly draftHasActionableSteps: boolean;
  readonly draftHasPremiseChallenge: boolean;
  readonly draftHasConcreteCritique: boolean;
  readonly draftHasValidationGuidance: boolean;
  readonly draftHasCodeLikeContent: boolean;
  readonly draftHasPromptLikeContent: boolean;
  readonly draftHasExcessiveAmbiguity: boolean;
  readonly draftHasDirectAnswer: boolean;
}

interface UserBenefitPenalty {
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

const HIGH_IMPACT_MARKERS = [
  "legal",
  "juridico",
  "jurídico",
  "lei",
  "norma",
  "edital",
  "contrato",
  "contract",
  "policy",
  "compliance",
  "medico",
  "médico",
  "medical",
  "saude",
  "saúde",
  "diagnostico",
  "diagnóstico",
  "cirurgia",
  "medicamento",
  "financeiro",
  "financeira",
  "finance",
  "investimento",
  "dinheiro",
  "producao",
  "produção",
  "production",
  "backup",
  "seguranca",
  "segurança",
  "security",
  "privacidade",
  "privacy",
  "deploy",
  "producao",
  "produção",
  "arquitetura",
  "architecture",
  "codigo em producao",
  "código em produção",
  "risco",
  "risk",
];

const DECISION_REQUEST_MARKERS = [
  "o que devo",
  "qual devo",
  "voce recomenda",
  "você recomenda",
  "recomende",
  "melhor escolha",
  "melhor caminho",
  "melhor opcao",
  "melhor opção",
  "vale a pena",
  "devo fazer",
  "posso fazer",
  "qual decisao",
  "qual decisão",
  "qual alternativa",
  "what should",
  "which should",
  "do you recommend",
  "best choice",
  "best option",
  "best path",
  "is it worth",
];

const ACTION_REQUEST_MARKERS = [
  "como fazer",
  "como resolver",
  "como ajustar",
  "me ajude a",
  "preciso de",
  "crie",
  "implemente",
  "corrija",
  "melhore",
  "substitua",
  "organize",
  "plano",
  "passo a passo",
  "how to",
  "help me",
  "create",
  "implement",
  "fix",
  "improve",
  "replace",
  "organize",
  "plan",
  "step by step",
];

const EVALUATION_REQUEST_MARKERS = [
  "avalie",
  "analise",
  "verifique",
  "o que voce acha",
  "o que você acha",
  "esta bom",
  "está bom",
  "ficou bom",
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

const IMPLEMENTATION_MARKERS = [
  "codigo",
  "código",
  "typescript",
  "javascript",
  "python",
  "nestjs",
  "arquivo",
  "funcao",
  "função",
  "classe",
  "interface",
  "implementar",
  "codex",
  "pipeline",
  "arquitetura",
  "code",
  "function",
  "class",
  "file",
  "implementation",
  "architecture",
];

const CODE_REQUEST_MARKERS = [
  "codigo",
  "código",
  "typescript",
  "javascript",
  "python",
  "funcao",
  "função",
  "function",
  "classe",
  "class",
  "interface",
  "arquivo",
  "substitua",
  "copiar e colar",
  "copy and paste",
  "code",
];

const PROMPT_REQUEST_MARKERS = [
  "prompt",
  "codex",
  "instrucoes para",
  "instruções para",
  "plano para o codex",
  "prompt detalhado",
  "prompt detalhista",
];

const STRONG_PREMISE_MARKERS = [
  "tenho certeza",
  "com certeza",
  "sem duvida",
  "sem dúvida",
  "obviamente",
  "claramente",
  "definitivamente",
  "isso prova",
  "isso comprova",
  "isso esta errado",
  "isso está errado",
  "a resposta esta errada",
  "a resposta está errada",
  "certainly",
  "undoubtedly",
  "obviously",
  "clearly",
  "definitely",
  "this proves",
  "this is wrong",
];

const PLEASER_TONE_MARKERS = [
  "concordo totalmente",
  "concordo plenamente",
  "voce esta certo",
  "você está certo",
  "voce tem toda razao",
  "você tem toda razão",
  "perfeito",
  "esta excelente",
  "está excelente",
  "ficou excelente",
  "sem duvida voce esta certo",
  "sem dúvida você está certo",
  "you are absolutely right",
  "i completely agree",
  "perfect",
  "excellent",
];

const RISK_MARKERS = [
  "risco",
  "cuidado",
  "atencao",
  "atenção",
  "perigo",
  "fragilidade",
  "limite",
  "limitacao",
  "limitação",
  "restricao",
  "restrição",
  "ressalva",
  "impacto",
  "consequencia",
  "consequência",
  "vulnerabilidade",
  "risk",
  "careful",
  "warning",
  "limitation",
  "constraint",
  "caveat",
  "impact",
  "consequence",
  "vulnerability",
];

const TRADEOFF_MARKERS = [
  "trade-off",
  "tradeoff",
  "vantagem",
  "desvantagem",
  "custo",
  "beneficio",
  "benefício",
  "alternativa",
  "comparar",
  "por outro lado",
  "compensacao",
  "compensação",
  "advantage",
  "disadvantage",
  "cost",
  "benefit",
  "alternative",
  "on the other hand",
];

const CAVEAT_MARKERS = [
  "depende",
  "ressalva",
  "limite",
  "limitação",
  "limitacao",
  "incerteza",
  "desde que",
  "a menos que",
  "se",
  "caso",
  "nao e possivel afirmar",
  "não é possível afirmar",
  "com os dados disponiveis",
  "com os dados disponíveis",
  "depends",
  "caveat",
  "limitation",
  "uncertainty",
  "provided that",
  "unless",
  "if",
  "cannot conclude",
  "with the available information",
];

const RECOMMENDATION_MARKERS = [
  "recomendo",
  "minha recomendacao",
  "minha recomendação",
  "o melhor caminho",
  "a melhor opcao",
  "a melhor opção",
  "eu faria",
  "deve",
  "priorize",
  "escolha",
  "sugiro",
  "recommend",
  "my recommendation",
  "best option",
  "best path",
  "you should",
  "prioritize",
  "choose",
  "suggest",
];

const ACTIONABLE_STEP_MARKERS = [
  "primeiro",
  "segundo",
  "terceiro",
  "passo",
  "etapa",
  "faça",
  "faca",
  "verifique",
  "ajuste",
  "substitua",
  "adicione",
  "remova",
  "teste",
  "valide",
  "implemente",
  "1.",
  "2.",
  "- ",
  "first",
  "second",
  "step",
  "check",
  "adjust",
  "replace",
  "add",
  "remove",
  "test",
  "validate",
  "implement",
];

const PREMISE_CHALLENGE_MARKERS = [
  "a premissa",
  "essa premissa",
  "precisa ser testada",
  "precisa ser verificada",
  "nao necessariamente",
  "não necessariamente",
  "isso nao prova",
  "isso não prova",
  "pode estar parcialmente correto",
  "pode estar errado",
  "hipotese alternativa",
  "hipótese alternativa",
  "outra interpretacao",
  "outra interpretação",
  "premise",
  "not necessarily",
  "does not prove",
  "alternative hypothesis",
  "alternative interpretation",
];

const CONCRETE_CRITIQUE_MARKERS = [
  "o problema",
  "a falha",
  "a fragilidade",
  "o limite",
  "o risco",
  "esta incompleto porque",
  "está incompleto porque",
  "nao procede porque",
  "não procede porque",
  "isso nao se sustenta",
  "isso não se sustenta",
  "falta explicar",
  "falta justificar",
  "falta concluir",
  "the problem",
  "the weakness",
  "the limitation",
  "this does not follow",
  "this is incomplete because",
  "needs justification",
];

const VALIDATION_MARKERS = [
  "teste",
  "valide",
  "verifique",
  "checagem",
  "teste unitario",
  "teste unitário",
  "teste de integracao",
  "teste de integração",
  "fallback",
  "rollback",
  "monitoramento",
  "log",
  "auditoria",
  "test",
  "validate",
  "check",
  "unit test",
  "integration test",
  "monitoring",
  "logging",
  "audit",
];

const AMBIGUITY_MARKERS = [
  "depende",
  "talvez",
  "pode ser",
  "nao sei",
  "não sei",
  "fica dificil",
  "fica difícil",
  "it depends",
  "maybe",
  "possibly",
  "not sure",
];

const DIRECT_ANSWER_MARKERS = [
  "sim",
  "nao",
  "não",
  "depende",
  "correto",
  "incorreto",
  "parcialmente",
  "o ponto central",
  "a resposta",
  "yes",
  "no",
  "it depends",
  "correct",
  "incorrect",
  "the answer",
];

export function scoreUserBenefit(
  input: UserBenefitInput,
): CouncilScoreResult {
  const context = buildUserBenefitContext(input);

  const penalties = dedupePenalties([
    ...checkProtectionAgainstPleaserTone(context),
    ...checkHighImpactUtility(context),
    ...checkDecisionUtility(context),
    ...checkActionability(context),
    ...checkEvaluationUtility(context),
    ...checkImplementationUtility(context),
    ...checkFormatUtility(context),
    ...checkAdvisorDerivedUtilityRisks(context),
    ...checkGoalAlignment(context),
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

  return {
    score,
    level: maxRisk(scoreLevel, minimumRisk),
    reasons: penalties.map((penalty) => penalty.reason),
  };
}

function buildUserBenefitContext(input: UserBenefitInput): UserBenefitContext {
  const userInput = input.councilInput.userInput ?? "";
  const draftAnswer = input.councilInput.draftAnswer ?? "";
  const normalizedUser = normalizeText(userInput);
  const normalizedDraft = normalizeText(draftAnswer);
  const advisorReports = input.advisorReports ?? [];

  const advisorConcerns = dedupe(
    advisorReports.flatMap((report) => report.concerns ?? []),
  );
  const advisorRequiredRevisions = dedupe(
    advisorReports.flatMap((report) => report.requiredRevisions ?? []),
  );
  const advisorUnsupportedClaims = dedupe(
    advisorReports.flatMap((report) => report.unsupportedClaims ?? []),
  );
  const advisorContradictions = dedupe(
    advisorReports.flatMap((report) => report.contradictions ?? []),
  );
  const advisorMissingCounterpoints = dedupe(
    advisorReports.flatMap((report) => report.missingCounterpoints ?? []),
  );
  const advisorOverAgreementSignals = dedupe(
    advisorReports.flatMap((report) => report.overAgreementSignals ?? []),
  );

  return {
    userInput,
    draftAnswer,
    normalizedUser,
    normalizedDraft,
    userWordCount: wordCount(userInput),
    draftWordCount: wordCount(draftAnswer),

    advisorReports,
    advisorConcerns,
    advisorRequiredRevisions,
    advisorUnsupportedClaims,
    advisorContradictions,
    advisorMissingCounterpoints,
    advisorOverAgreementSignals,

    highImpact: containsAny(normalizedUser, HIGH_IMPACT_MARKERS),
    userRequestsDecision: containsAny(normalizedUser, DECISION_REQUEST_MARKERS),
    userRequestsAction: containsAny(normalizedUser, ACTION_REQUEST_MARKERS),
    userRequestsEvaluation: containsAny(normalizedUser, EVALUATION_REQUEST_MARKERS),
    userRequestsImplementation: containsAny(normalizedUser, IMPLEMENTATION_MARKERS),
    userRequestsCode: containsAny(normalizedUser, CODE_REQUEST_MARKERS),
    userRequestsPrompt: containsAny(normalizedUser, PROMPT_REQUEST_MARKERS),
    userShowsStrongPremise: containsAny(normalizedUser, STRONG_PREMISE_MARKERS),

    draftHasPleaserTone: containsAny(normalizedDraft, PLEASER_TONE_MARKERS),
    draftHasRiskAwareness: containsAny(normalizedDraft, RISK_MARKERS),
    draftHasTradeoffAwareness: containsAny(normalizedDraft, TRADEOFF_MARKERS),
    draftHasCaveats: containsAny(normalizedDraft, CAVEAT_MARKERS),
    draftHasRecommendation: containsAny(normalizedDraft, RECOMMENDATION_MARKERS),
    draftHasActionableSteps: containsAny(normalizedDraft, ACTIONABLE_STEP_MARKERS),
    draftHasPremiseChallenge: containsAny(normalizedDraft, PREMISE_CHALLENGE_MARKERS),
    draftHasConcreteCritique: containsAny(normalizedDraft, CONCRETE_CRITIQUE_MARKERS),
    draftHasValidationGuidance: containsAny(normalizedDraft, VALIDATION_MARKERS),
    draftHasCodeLikeContent: looksLikeCodeAnswer(draftAnswer),
    draftHasPromptLikeContent: looksLikePromptAnswer(normalizedDraft),
    draftHasExcessiveAmbiguity: hasExcessiveAmbiguity(normalizedDraft),
    draftHasDirectAnswer: hasDirectAnswerEarly(normalizedDraft),
  };
}

function checkProtectionAgainstPleaserTone(
  context: UserBenefitContext,
): UserBenefitPenalty[] {
  const penalties: UserBenefitPenalty[] = [];

  if (
    context.draftHasPleaserTone &&
    !context.draftHasRiskAwareness &&
    !context.draftHasPremiseChallenge &&
    !context.draftHasConcreteCritique
  ) {
    penalties.push({
      reason: "agreement_over_user_protection",
      penalty: context.highImpact ? 0.36 : 0.28,
      minimumRisk: context.highImpact ? "high" : "medium",
    });
  }

  if (
    context.userShowsStrongPremise &&
    context.draftHasPleaserTone &&
    !context.draftHasPremiseChallenge
  ) {
    penalties.push({
      reason: "strong_user_premise_not_protected_by_challenge",
      penalty: 0.26,
      minimumRisk: "medium",
    });
  }

  if (
    context.advisorOverAgreementSignals.length > 0 &&
    !context.draftHasPremiseChallenge
  ) {
    penalties.push({
      reason: "advisor_flagged_over_agreement_against_user_interest",
      penalty: 0.22,
      minimumRisk: "medium",
    });
  }

  return penalties;
}

function checkHighImpactUtility(
  context: UserBenefitContext,
): UserBenefitPenalty[] {
  const penalties: UserBenefitPenalty[] = [];

  if (!context.highImpact) {
    return penalties;
  }

  if (context.draftWordCount < 120) {
    penalties.push({
      reason: "insufficient_guidance_for_high_impact_context",
      penalty: 0.28,
      minimumRisk: "high",
    });
  }

  if (
    !context.draftHasRiskAwareness &&
    !context.draftHasCaveats &&
    !context.draftHasTradeoffAwareness
  ) {
    penalties.push({
      reason: "high_impact_guidance_without_risk_boundaries",
      penalty: 0.3,
      minimumRisk: "high",
    });
  }

  if (
    context.draftHasExcessiveAmbiguity &&
    !context.draftHasRecommendation &&
    !context.draftHasActionableSteps
  ) {
    penalties.push({
      reason: "high_impact_ambiguity_without_direction",
      penalty: 0.24,
      minimumRisk: "medium",
    });
  }

  return penalties;
}

function checkDecisionUtility(
  context: UserBenefitContext,
): UserBenefitPenalty[] {
  const penalties: UserBenefitPenalty[] = [];

  if (!context.userRequestsDecision) {
    return penalties;
  }

  if (!context.draftHasRecommendation) {
    penalties.push({
      reason: "decision_request_without_recommendation",
      penalty: context.highImpact ? 0.26 : 0.2,
      minimumRisk: context.highImpact ? "high" : "medium",
    });
  }

  if (
    context.draftHasRecommendation &&
    !context.draftHasCaveats &&
    !context.draftHasRiskAwareness &&
    context.highImpact
  ) {
    penalties.push({
      reason: "recommendation_without_boundary_conditions",
      penalty: 0.22,
      minimumRisk: "medium",
    });
  }

  return penalties;
}

function checkActionability(
  context: UserBenefitContext,
): UserBenefitPenalty[] {
  const penalties: UserBenefitPenalty[] = [];

  const actionabilityExpected =
    context.userRequestsAction ||
    context.userRequestsDecision ||
    context.userRequestsImplementation ||
    context.highImpact;

  if (!actionabilityExpected) {
    return penalties;
  }

  if (!context.draftHasActionableSteps && !context.draftHasRecommendation) {
    penalties.push({
      reason: "missing_actionable_next_step",
      penalty: 0.18,
      minimumRisk: "medium",
    });
  }

  if (
    context.draftHasActionableSteps &&
    context.highImpact &&
    !context.draftHasValidationGuidance &&
    context.userRequestsImplementation
  ) {
    penalties.push({
      reason: "action_steps_without_validation_in_high_impact_context",
      penalty: 0.18,
      minimumRisk: "medium",
    });
  }

  return penalties;
}

function checkEvaluationUtility(
  context: UserBenefitContext,
): UserBenefitPenalty[] {
  const penalties: UserBenefitPenalty[] = [];

  if (!context.userRequestsEvaluation) {
    return penalties;
  }

  if (!context.draftHasConcreteCritique && !context.draftHasPremiseChallenge) {
    penalties.push({
      reason: "evaluation_without_user_improvement_value",
      penalty: 0.22,
      minimumRisk: "medium",
    });
  }

  if (
    context.userRequestsEvaluation &&
    !context.draftHasActionableSteps &&
    !context.draftHasRecommendation &&
    context.draftWordCount > 80
  ) {
    penalties.push({
      reason: "evaluation_without_actionable_improvement_path",
      penalty: 0.14,
    });
  }

  return penalties;
}

function checkImplementationUtility(
  context: UserBenefitContext,
): UserBenefitPenalty[] {
  const penalties: UserBenefitPenalty[] = [];

  if (!context.userRequestsImplementation) {
    return penalties;
  }

  if (!context.draftHasValidationGuidance && context.draftWordCount > 80) {
    penalties.push({
      reason: "implementation_guidance_without_validation_path",
      penalty: 0.2,
      minimumRisk: "medium",
    });
  }

  if (
    context.highImpact &&
    !context.draftHasRiskAwareness &&
    !context.draftHasValidationGuidance
  ) {
    penalties.push({
      reason: "implementation_guidance_without_safety_or_testing_boundary",
      penalty: 0.22,
      minimumRisk: "medium",
    });
  }

  return penalties;
}

function checkFormatUtility(
  context: UserBenefitContext,
): UserBenefitPenalty[] {
  const penalties: UserBenefitPenalty[] = [];

  if (context.userRequestsCode && !context.draftHasCodeLikeContent) {
    penalties.push({
      reason: "requested_code_not_provided",
      penalty: 0.3,
      minimumRisk: "high",
    });
  }

  if (context.userRequestsPrompt && !context.draftHasPromptLikeContent) {
    penalties.push({
      reason: "requested_prompt_not_provided",
      penalty: 0.24,
      minimumRisk: "medium",
    });
  }

  return penalties;
}

function checkAdvisorDerivedUtilityRisks(
  context: UserBenefitContext,
): UserBenefitPenalty[] {
  const penalties: UserBenefitPenalty[] = [];
  const joinedConcerns = normalizeText(context.advisorConcerns.join(" "));
  const joinedRevisions = normalizeText(context.advisorRequiredRevisions.join(" "));

  if (
    joinedConcerns.includes("insufficient_depth_for_high_impact_decision") ||
    joinedConcerns.includes("missing_actionable_next_steps") ||
    joinedConcerns.includes("decision_request_without_recommendation")
  ) {
    penalties.push({
      reason: "advisor_flagged_low_practical_value",
      penalty: 0.18,
      minimumRisk: "medium",
    });
  }

  if (context.advisorContradictions.length > 0) {
    penalties.push({
      reason: "contradictions_reduce_user_benefit",
      penalty: 0.26,
      minimumRisk: "high",
    });
  }

  if (context.advisorUnsupportedClaims.length > 0) {
    penalties.push({
      reason: "unsupported_claims_reduce_user_benefit",
      penalty: 0.2,
      minimumRisk: "medium",
    });
  }

  if (context.advisorMissingCounterpoints.length > 0) {
    penalties.push({
      reason: "missing_counterpoints_reduce_decision_quality",
      penalty: 0.16,
      minimumRisk: "medium",
    });
  }

  if (
    context.advisorRequiredRevisions.length > 0 &&
    /user|benefit|action|decision|risk|premise|evidence|logic|complete|revision/.test(
      joinedRevisions,
    )
  ) {
    penalties.push({
      reason: "required_revisions_still_affect_user_benefit",
      penalty: 0.16,
      minimumRisk: "medium",
    });
  }

  return penalties;
}

function checkGoalAlignment(
  context: UserBenefitContext,
): UserBenefitPenalty[] {
  const penalties: UserBenefitPenalty[] = [];

  if (context.normalizedDraft.length < 40) {
    penalties.push({
      reason: "answer_too_short_to_serve_user_goal",
      penalty: 0.24,
      minimumRisk: "medium",
    });

    return penalties;
  }

  if (looksLikeQuestion(context.userInput) && !context.draftHasDirectAnswer) {
    penalties.push({
      reason: "question_without_direct_answer",
      penalty: 0.14,
      minimumRisk: "medium",
    });
  }

  if (!hasAnyUserGoalSignalInDraft(context)) {
    penalties.push({
      reason: "draft_weakly_aligned_with_user_goal",
      penalty: 0.18,
      minimumRisk: "medium",
    });
  }

  return penalties;
}

function hasExcessiveAmbiguity(normalizedDraft: string): boolean {
  const ambiguityCount = countMarkerHits(normalizedDraft, AMBIGUITY_MARKERS);
  const recommendationCount = countMarkerHits(
    normalizedDraft,
    RECOMMENDATION_MARKERS,
  );
  const actionableCount = countMarkerHits(normalizedDraft, ACTIONABLE_STEP_MARKERS);

  return ambiguityCount >= 2 && recommendationCount === 0 && actionableCount === 0;
}

function hasDirectAnswerEarly(normalizedDraft: string): boolean {
  const firstChunk = normalizedDraft.slice(0, 280);

  return containsAny(firstChunk, DIRECT_ANSWER_MARKERS);
}

function hasAnyUserGoalSignalInDraft(context: UserBenefitContext): boolean {
  const salientTerms = extractSalientTerms(context.normalizedUser);

  if (salientTerms.length === 0) {
    return true;
  }

  const matchedTerms = salientTerms.filter((term) =>
    context.normalizedDraft.includes(term),
  );

  return matchedTerms.length / Math.max(1, salientTerms.length) >= 0.18;
}

function extractSalientTerms(normalizedTextValue: string): string[] {
  const stopwords = new Set([
    "preciso",
    "quero",
    "agora",
    "isso",
    "esse",
    "essa",
    "para",
    "como",
    "voce",
    "você",
    "fazer",
    "criar",
    "melhorar",
    "codigo",
    "código",
    "arquivo",
    "resposta",
    "texto",
    "seguinte",
    "agora",
    "the",
    "and",
    "that",
    "this",
    "need",
    "want",
    "answer",
    "code",
  ]);

  return dedupe(
    normalizedTextValue
      .split(/\s+/g)
      .map((term) => term.trim())
      .filter((term) => term.length >= 5 && !stopwords.has(term)),
  ).slice(0, 16);
}

function looksLikeQuestion(text: string): boolean {
  const normalized = normalizeText(text);

  if (text.includes("?")) {
    return true;
  }

  return /\b(o que|qual|quais|como|por que|porque|voce acha|você acha|esta certo|está certo|esta errado|está errado|faz sentido|what|why|how|which)\b/.test(
    normalized,
  );
}

function looksLikeCodeAnswer(rawDraft: string): boolean {
  return (
    /```[\s\S]+```/.test(rawDraft) ||
    /\b(import|export|function|const|let|class|interface|type)\b/.test(rawDraft)
  );
}

function looksLikePromptAnswer(normalizedDraft: string): boolean {
  return (
    normalizedDraft.includes("voce deve") ||
    normalizedDraft.includes("você deve") ||
    normalizedDraft.includes("you must") ||
    normalizedDraft.includes("objetivo") ||
    normalizedDraft.includes("instrucoes") ||
    normalizedDraft.includes("instruções") ||
    normalizedDraft.includes("criterios") ||
    normalizedDraft.includes("critérios")
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
  return RISK_WEIGHT[left] >= RISK_WEIGHT[right] ? left : right;
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

function countMarkerHits(text: string, markers: readonly string[]): number {
  return markers.reduce(
    (count, marker) => count + (containsMarker(text, marker) ? 1 : 0),
    0,
  );
}

function dedupePenalties(
  penalties: readonly UserBenefitPenalty[],
): UserBenefitPenalty[] {
  const byReason = new Map<string, UserBenefitPenalty>();

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

  return Array.from(byReason.values()).sort(
    (left, right) => right.penalty - left.penalty,
  );
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