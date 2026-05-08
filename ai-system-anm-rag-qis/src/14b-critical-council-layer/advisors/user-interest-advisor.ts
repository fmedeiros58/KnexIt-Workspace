import type {
  CouncilAdvisorReport,
  CouncilInput,
  CouncilRiskLevel,
} from "../council-types";
import {
  confidenceFromSignals,
  dedupeNormalized,
  isRiskAtLeast,
  maxRiskLevel,
  normalizeText,
} from "./advisor-utils";

type UserInterestConcernId =
  | "insufficient_depth_for_high_impact_decision"
  | "prioritizes_pleasing_over_helping"
  | "excessive_ambiguity_without_guidance"
  | "missing_actionable_next_steps"
  | "missing_risk_or_tradeoff_awareness"
  | "overconfident_high_impact_guidance_without_caveats"
  | "premise_fragility_not_flagged"
  | "decision_request_without_recommendation"
  | "implementation_guidance_without_validation"
  | "user_goal_not_directly_served"
  | "critique_softened_against_user_interest"
  | "advice_without_boundary_conditions";

interface UserInterestFinding {
  readonly id: UserInterestConcernId;
  readonly risk: CouncilRiskLevel;
  readonly message: string;
  readonly requiredRevision?: string;
  readonly optionalRevision?: string;
}

interface UserInterestContext {
  readonly userInput: string;
  readonly draftAnswer: string;
  readonly normalizedUser: string;
  readonly normalizedDraft: string;
  readonly userWordCount: number;
  readonly draftWordCount: number;

  readonly highImpact: boolean;
  readonly userRequestsDecision: boolean;
  readonly userRequestsAction: boolean;
  readonly userRequestsEvaluation: boolean;
  readonly userRequestsImplementation: boolean;
  readonly userShowsStrongPremise: boolean;
  readonly userAsksIfSomethingIsCorrect: boolean;

  readonly draftHasPleaserTone: boolean;
  readonly draftHasRiskAwareness: boolean;
  readonly draftHasTradeoffAwareness: boolean;
  readonly draftHasActionableSteps: boolean;
  readonly draftHasRecommendation: boolean;
  readonly draftHasCaveats: boolean;
  readonly draftHasPremiseChallenge: boolean;
  readonly draftHasValidationGuidance: boolean;
  readonly draftHasExcessiveAmbiguity: boolean;
  readonly draftHasHighConfidenceLanguage: boolean;
  readonly draftHasNecessaryCritique: boolean;
}

const ADVISOR_ID = "user_interest";
const ADVISOR_NAME = "User-Interest Advisor";

const HIGH_IMPACT_MARKERS = [
  "legal",
  "juridico",
  "juridica",
  "lei",
  "norma",
  "edital",
  "contrato",
  "contract",
  "policy",
  "compliance",
  "medico",
  "medica",
  "medical",
  "saude",
  "diagnostico",
  "cirurgia",
  "medicamento",
  "financeiro",
  "financeira",
  "finance",
  "investimento",
  "dinheiro",
  "producao",
  "production",
  "backup",
  "seguranca",
  "security",
  "privacidade",
  "privacy",
  "deploy",
  "infraestrutura",
  "arquitetura",
  "codigo em producao",
  "risco",
  "risk",
];

const DECISION_REQUEST_MARKERS = [
  "o que devo",
  "qual devo",
  "voce recomenda",
  "recomende",
  "melhor escolha",
  "melhor caminho",
  "vale a pena",
  "devo fazer",
  "posso fazer",
  "qual decisao",
  "qual alternativa",
  "what should",
  "which should",
  "do you recommend",
  "best choice",
  "best option",
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
  "plan",
  "step by step",
];

const EVALUATION_REQUEST_MARKERS = [
  "avalie",
  "analise",
  "verifique",
  "o que voce acha",
  "esta bom",
  "ficou bom",
  "esta ruim",
  "esta certo",
  "esta errado",
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
  "typescript",
  "javascript",
  "python",
  "nestjs",
  "arquivo",
  "funcao",
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

const STRONG_PREMISE_MARKERS = [
  "tenho certeza",
  "com certeza",
  "sem duvida",
  "obviamente",
  "claramente",
  "definitivamente",
  "isso prova",
  "a resposta esta errada",
  "isso esta errado",
  "isso esta ruim",
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
  "voce esta certo",
  "voce tem toda razao",
  "perfeito",
  "esta excelente",
  "ficou excelente",
  "sem duvida voce esta certo",
  "you are absolutely right",
  "i completely agree",
  "perfect",
  "excellent",
];

const RISK_MARKERS = [
  "risco",
  "cuidado",
  "atenção",
  "atencao",
  "perigo",
  "fragilidade",
  "limite",
  "restricao",
  "ressalva",
  "impacto",
  "consequencia",
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

const VALIDATION_MARKERS = [
  "teste",
  "valide",
  "verifique",
  "checagem",
  "teste unitario",
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

const HIGH_CONFIDENCE_MARKERS = [
  "com certeza",
  "sem duvida",
  "sem dúvida",
  "definitivamente",
  "obviamente",
  "certamente",
  "necessariamente",
  "certainly",
  "undoubtedly",
  "definitely",
  "obviously",
  "necessarily",
];

const NECESSARY_CRITIQUE_MARKERS = [
  "problema",
  "falha",
  "fragil",
  "frágil",
  "incompleto",
  "incorreto",
  "errado",
  "limite",
  "nao procede",
  "não procede",
  "precisa corrigir",
  "problem",
  "failure",
  "weak",
  "incomplete",
  "incorrect",
  "wrong",
  "limitation",
  "needs correction",
];

export function runUserInterestAdvisor(
  input: CouncilInput,
): CouncilAdvisorReport {
  const context = buildUserInterestContext(input);
  const findings = dedupeFindings([
    ...findHighImpactGaps(context),
    ...findPleaserToneGaps(context),
    ...findDecisionAndActionGaps(context),
    ...findPremiseAndCritiqueGaps(context),
    ...findImplementationGaps(context),
    ...findBoundaryConditionGaps(context),
  ]);

  const risk = maxRiskLevel(findings.map((finding) => finding.risk));
  const concerns = dedupeNormalized([...findings.map((finding) => finding.id)]);

  const requiredRevisions = dedupeNormalized([
    ...findings
      .map((finding) => finding.requiredRevision)
      .filter((revision): revision is string => Boolean(revision)),
  ]);

  const optionalRevisions = dedupeNormalized([
    ...findings
      .map((finding) => finding.optionalRevision)
      .filter((revision): revision is string => Boolean(revision)),
  ]);

  const hardSignals = findings.filter((finding) =>
    isRiskAtLeast(finding.risk, "high"),
  ).length;

  return {
    advisorId: ADVISOR_ID,
    advisorName: ADVISOR_NAME,
    passed: risk === "low",
    risk,
    concerns,
    strengths: risk === "low" ? buildStrengths(context) : [],
    requiredRevisions,
    optionalRevisions:
      optionalRevisions.length > 0
        ? optionalRevisions
        : risk === "low"
          ? [
              "Preserve practical next steps and user-benefit orientation when the user asks for decisions, implementation or evaluation.",
            ]
          : [],
    confidence: confidenceFromSignals(findings.length, hardSignals),
  };
}

function buildUserInterestContext(input: CouncilInput): UserInterestContext {
  const userInput = input.userInput ?? "";
  const draftAnswer = input.draftAnswer ?? "";
  const normalizedUser = normalizeText(userInput);
  const normalizedDraft = normalizeText(draftAnswer);

  return {
    userInput,
    draftAnswer,
    normalizedUser,
    normalizedDraft,
    userWordCount: wordCount(userInput),
    draftWordCount: wordCount(draftAnswer),

    highImpact: containsAny(normalizedUser, HIGH_IMPACT_MARKERS),
    userRequestsDecision: containsAny(normalizedUser, DECISION_REQUEST_MARKERS),
    userRequestsAction: containsAny(normalizedUser, ACTION_REQUEST_MARKERS),
    userRequestsEvaluation: containsAny(
      normalizedUser,
      EVALUATION_REQUEST_MARKERS,
    ),
    userRequestsImplementation: containsAny(
      normalizedUser,
      IMPLEMENTATION_MARKERS,
    ),
    userShowsStrongPremise: containsAny(normalizedUser, STRONG_PREMISE_MARKERS),
    userAsksIfSomethingIsCorrect:
      normalizedUser.includes("esta certo") ||
      normalizedUser.includes("esta errado") ||
      normalizedUser.includes("faz sentido") ||
      normalizedUser.includes("is this right") ||
      normalizedUser.includes("is this wrong") ||
      normalizedUser.includes("does it make sense"),

    draftHasPleaserTone: containsAny(normalizedDraft, PLEASER_TONE_MARKERS),
    draftHasRiskAwareness: containsAny(normalizedDraft, RISK_MARKERS),
    draftHasTradeoffAwareness: containsAny(normalizedDraft, TRADEOFF_MARKERS),
    draftHasActionableSteps: containsAny(normalizedDraft, ACTIONABLE_STEP_MARKERS),
    draftHasRecommendation: containsAny(normalizedDraft, RECOMMENDATION_MARKERS),
    draftHasCaveats: containsAny(normalizedDraft, CAVEAT_MARKERS),
    draftHasPremiseChallenge: containsAny(
      normalizedDraft,
      PREMISE_CHALLENGE_MARKERS,
    ),
    draftHasValidationGuidance: containsAny(normalizedDraft, VALIDATION_MARKERS),
    draftHasExcessiveAmbiguity: hasExcessiveAmbiguity(normalizedDraft),
    draftHasHighConfidenceLanguage: containsAny(
      normalizedDraft,
      HIGH_CONFIDENCE_MARKERS,
    ),
    draftHasNecessaryCritique: containsAny(
      normalizedDraft,
      NECESSARY_CRITIQUE_MARKERS,
    ),
  };
}

function findHighImpactGaps(
  context: UserInterestContext,
): UserInterestFinding[] {
  const findings: UserInterestFinding[] = [];

  if (context.highImpact && context.draftWordCount < 120) {
    findings.push({
      id: "insufficient_depth_for_high_impact_decision",
      risk: "high",
      message:
        "The user request appears high-impact, but the draft is too shallow for safe or useful guidance.",
      requiredRevision:
        "Provide risk-aware guidance with concrete limits, practical next steps and conditions that could change the recommendation.",
    });
  }

  if (
    context.highImpact &&
    !context.draftHasRiskAwareness &&
    (context.userRequestsDecision || context.userRequestsAction)
  ) {
    findings.push({
      id: "missing_risk_or_tradeoff_awareness",
      risk: "high",
      message:
        "The response gives guidance in a high-impact context without enough risk or trade-off awareness.",
      requiredRevision:
        "Add relevant risks, trade-offs, constraints and verification steps before giving a final direction.",
    });
  }

  if (
    context.highImpact &&
    context.draftHasHighConfidenceLanguage &&
    !context.draftHasCaveats
  ) {
    findings.push({
      id: "overconfident_high_impact_guidance_without_caveats",
      risk: "high",
      message:
        "The draft uses high-confidence language in a high-impact context without caveats.",
      requiredRevision:
        "Calibrate certainty. Add caveats, boundary conditions or verification requirements before making a strong recommendation.",
    });
  }

  if (
    context.highImpact &&
    context.draftHasExcessiveAmbiguity &&
    !context.draftHasRecommendation
  ) {
    findings.push({
      id: "excessive_ambiguity_without_guidance",
      risk: "high",
      message:
        "The draft is ambiguous in a high-impact context and does not give enough practical direction.",
      requiredRevision:
        "Reduce ambiguity by giving a clear recommended direction, while preserving caveats and limits.",
    });
  }

  return findings;
}

function findPleaserToneGaps(
  context: UserInterestContext,
): UserInterestFinding[] {
  if (
    !context.draftHasPleaserTone ||
    context.draftHasRiskAwareness ||
    context.draftHasPremiseChallenge ||
    context.draftHasNecessaryCritique
  ) {
    return [];
  }

  return [
    {
      id: "prioritizes_pleasing_over_helping",
      risk: context.highImpact ? "high" : "medium",
      message:
        "The draft appears to prioritize agreement or pleasing tone over the user's real benefit.",
      requiredRevision:
        "Prioritize user benefit. Validate only what is justified, flag premise fragility and add concrete critique when needed.",
    },
  ];
}

function findDecisionAndActionGaps(
  context: UserInterestContext,
): UserInterestFinding[] {
  const findings: UserInterestFinding[] = [];

  if (context.userRequestsDecision && !context.draftHasRecommendation) {
    findings.push({
      id: "decision_request_without_recommendation",
      risk: context.highImpact ? "high" : "medium",
      message:
        "The user appears to request a decision or recommendation, but the draft does not provide a clear direction.",
      requiredRevision:
        "Give a clear recommended direction or explain exactly what missing information prevents a recommendation.",
    });
  }

  if (context.userRequestsAction && !context.draftHasActionableSteps) {
    findings.push({
      id: "missing_actionable_next_steps",
      risk: "medium",
      message:
        "The user asks for action-oriented help, but the draft lacks practical next steps.",
      requiredRevision:
        "Add concrete next steps, implementation steps or a practical checklist aligned with the user's goal.",
    });
  }

  if (
    (context.userRequestsDecision || context.userRequestsAction) &&
    context.draftHasRecommendation &&
    !context.draftHasCaveats &&
    !context.draftHasRiskAwareness
  ) {
    findings.push({
      id: "advice_without_boundary_conditions",
      risk: context.highImpact ? "high" : "medium",
      message:
        "The draft gives advice without enough boundary conditions or constraints.",
      requiredRevision:
        "State the conditions under which the recommendation holds and what would change the answer.",
    });
  }

  return findings;
}

function findPremiseAndCritiqueGaps(
  context: UserInterestContext,
): UserInterestFinding[] {
  const findings: UserInterestFinding[] = [];

  if (
    (context.userShowsStrongPremise || context.userAsksIfSomethingIsCorrect) &&
    !context.draftHasPremiseChallenge &&
    context.draftHasPleaserTone
  ) {
    findings.push({
      id: "premise_fragility_not_flagged",
      risk: "high",
      message:
        "The user presents or tests a premise, but the draft appears to accept it without enough challenge.",
      requiredRevision:
        "Treat the user's premise as a hypothesis. Explain what is correct, what is weak and what still needs validation.",
    });
  }

  if (
    context.userRequestsEvaluation &&
    !context.draftHasNecessaryCritique &&
    context.draftHasPleaserTone
  ) {
    findings.push({
      id: "critique_softened_against_user_interest",
      risk: "medium",
      message:
        "The user asks for evaluation, but the draft softens or omits critique that would help the user improve.",
      requiredRevision:
        "Add at least one concrete weakness, why it matters and how to improve it, while preserving respectful tone.",
    });
  }

  return findings;
}

function findImplementationGaps(
  context: UserInterestContext,
): UserInterestFinding[] {
  if (
    !context.userRequestsImplementation ||
    context.draftHasValidationGuidance ||
    context.draftWordCount < 80
  ) {
    return [];
  }

  return [
    {
      id: "implementation_guidance_without_validation",
      risk: context.highImpact ? "high" : "medium",
      message:
        "The user asks for implementation or architecture guidance, but the draft lacks validation or testing direction.",
      requiredRevision:
        "Add validation, testing, rollback, logging or verification guidance appropriate to the implementation context.",
    },
  ];
}

function findBoundaryConditionGaps(
  context: UserInterestContext,
): UserInterestFinding[] {
  if (
    !context.draftHasRecommendation ||
    context.draftHasCaveats ||
    context.draftHasRiskAwareness
  ) {
    return [];
  }

  if (
    context.highImpact ||
    context.userRequestsDecision ||
    context.userRequestsImplementation
  ) {
    return [
      {
        id: "advice_without_boundary_conditions",
        risk: context.highImpact ? "high" : "medium",
        message:
          "The draft recommends a direction without stating enough boundary conditions.",
        requiredRevision:
          "Add when the recommendation applies, when it does not apply and what information would change it.",
      },
    ];
  }

  return [];
}

function buildStrengths(context: UserInterestContext): string[] {
  const strengths = [
    "Response appears aligned with the user's real-world benefit.",
  ];

  if (context.draftHasActionableSteps) {
    strengths.push("The draft includes actionable next steps.");
  }

  if (context.draftHasRiskAwareness) {
    strengths.push("The draft includes risk-aware guidance.");
  }

  if (context.draftHasPremiseChallenge) {
    strengths.push("The draft does not simply accept the user's premise.");
  }

  if (context.draftHasRecommendation && context.draftHasCaveats) {
    strengths.push("The draft gives direction while preserving boundary conditions.");
  }

  return dedupeNormalized(strengths);
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

function dedupeFindings(
  findings: readonly UserInterestFinding[],
): UserInterestFinding[] {
  const byId = new Map<UserInterestConcernId, UserInterestFinding>();

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

function wordCount(text: string): number {
  return normalizeText(text)
    .split(/\s+/g)
    .map((token) => token.trim())
    .filter(Boolean).length;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}