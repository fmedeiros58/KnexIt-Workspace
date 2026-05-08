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

type SkepticalConcernId =
  | "strong_user_premise_without_counterpoint"
  | "agreement_first_without_premise_testing"
  | "premise_accepted_without_testing"
  | "alternative_hypothesis_not_considered"
  | "single_explanation_claim_without_comparison"
  | "high_stakes_claim_without_skeptical_check"
  | "evaluation_request_without_critical_tension"
  | "overconfident_conclusion_without_objection"
  | "causal_claim_without_alternative"
  | "no_counterexample_considered"
  | "weak_skeptical_posture";

interface SkepticalFinding {
  readonly id: SkepticalConcernId;
  readonly risk: CouncilRiskLevel;
  readonly message: string;
  readonly requiredRevision?: string;
  readonly optionalRevision?: string;
  readonly missingCounterpoint?: string;
}

interface SkepticalContext {
  readonly userHasStrongPremise: boolean;
  readonly userRequestsEvaluation: boolean;
  readonly userRequestsVerification: boolean;
  readonly userPresentsContestedClaim: boolean;
  readonly userTaskIsHighStakes: boolean;
  readonly draftStartsWithAgreement: boolean;
  readonly draftTestsPremise: boolean;
  readonly draftHasCounterpoint: boolean;
  readonly draftHasAlternativeHypothesis: boolean;
  readonly draftHasUncertaintyBoundary: boolean;
  readonly draftHasCounterexample: boolean;
  readonly draftClaimsSingleExplanation: boolean;
  readonly draftHasOverconfidentConclusion: boolean;
  readonly draftHasCausalClaim: boolean;
}

const ADVISOR_ID = "skeptical";
const ADVISOR_NAME = "Skeptical Advisor";

const STRONG_PREMISE_MARKERS = [
  "tenho certeza",
  "com certeza",
  "sem duvida",
  "obviamente",
  "claramente",
  "definitivamente",
  "prova",
  "comprova",
  "e evidente",
  "nao tem erro",
  "isso prova",
  "certainly",
  "undoubtedly",
  "obviously",
  "clearly",
  "definitely",
  "proves",
  "this proves",
];

const AGREEMENT_FIRST_MARKERS = [
  "concordo totalmente",
  "voce esta certo",
  "voce tem razao",
  "exatamente",
  "perfeito",
  "sem duvida voce esta certo",
  "i agree completely",
  "you are right",
  "exactly",
  "absolutely right",
];

const COUNTERPOINT_MARKERS = [
  "porem",
  "mas",
  "no entanto",
  "contudo",
  "por outro lado",
  "limite",
  "ressalva",
  "contraponto",
  "contraargumento",
  "objeção",
  "objecao",
  "alternativa",
  "contraexemplo",
  "however",
  "but",
  "on the other hand",
  "limitation",
  "caveat",
  "counterpoint",
  "counterargument",
  "objection",
  "alternative",
  "counterexample",
];

const PREMISE_TESTING_MARKERS = [
  "testar a premissa",
  "validar a premissa",
  "avaliar a premissa",
  "a premissa",
  "hipotese alternativa",
  "hipotese concorrente",
  "antes de concordar",
  "precisa ser verificado",
  "precisa ser testado",
  "nao da para assumir",
  "premise validation",
  "test the premise",
  "validate the premise",
  "alternative hypothesis",
  "competing hypothesis",
  "stress test",
  "cannot assume",
];

const ALTERNATIVE_HYPOTHESIS_MARKERS = [
  "hipotese alternativa",
  "outra possibilidade",
  "outra interpretacao",
  "explicacao alternativa",
  "cenario alternativo",
  "tambem pode ser",
  "pode haver",
  "alternative hypothesis",
  "another possibility",
  "alternative interpretation",
  "alternative explanation",
  "alternative scenario",
];

const UNCERTAINTY_BOUNDARY_MARKERS = [
  "depende",
  "limite",
  "incerteza",
  "ressalva",
  "nao e possivel afirmar",
  "nao da para concluir",
  "com os dados disponiveis",
  "sem mais informacoes",
  "limitation",
  "uncertainty",
  "caveat",
  "cannot conclude",
  "depends",
  "with the available information",
];

const COUNTEREXAMPLE_MARKERS = [
  "contraexemplo",
  "excecao",
  "caso em que falha",
  "isso falha quando",
  "nem sempre",
  "counterexample",
  "exception",
  "case where it fails",
  "does not always",
];

const SINGLE_EXPLANATION_MARKERS = [
  "unica explicacao",
  "unica possibilidade",
  "nao ha alternativa",
  "so pode ser",
  "necessariamente e",
  "only explanation",
  "only possibility",
  "no alternative",
  "must be",
];

const OVERCONFIDENT_CONCLUSION_MARKERS = [
  "com certeza",
  "sem duvida",
  "definitivamente",
  "obviamente",
  "necessariamente",
  "esta provado",
  "fica provado",
  "certainly",
  "undoubtedly",
  "definitely",
  "obviously",
  "necessarily",
  "it is proven",
];

const EVALUATION_REQUEST_MARKERS = [
  "avalie",
  "verifique",
  "analise",
  "o que voce acha",
  "esta bom",
  "esta ruim",
  "esta certo",
  "esta errado",
  "faz sentido",
  "minha ideia",
  "meu texto",
  "essa resposta",
  "evaluate",
  "verify",
  "check",
  "what do you think",
  "is it good",
  "is this right",
  "does it make sense",
];

const VERIFICATION_REQUEST_MARKERS = [
  "verifique",
  "confirme",
  "cheque",
  "tem certeza",
  "validar",
  "avaliar se",
  "verify",
  "confirm",
  "check",
  "are you sure",
  "validate",
];

const CONTESTED_CLAIM_MARKERS = [
  "isso esta errado",
  "isso esta ruim",
  "esta errado",
  "nao concordo",
  "a ia errou",
  "a resposta esta errada",
  "isso prova que",
  "isso significa que",
  "this is wrong",
  "i disagree",
  "the answer is wrong",
  "this proves that",
  "this means that",
];

const HIGH_STAKES_MARKERS = [
  "lei",
  "edital",
  "juridico",
  "norma",
  "medico",
  "saude",
  "diagnostico",
  "financeiro",
  "investimento",
  "seguranca",
  "codigo",
  "producao",
  "arquitetura",
  "legal",
  "law",
  "medical",
  "health",
  "diagnosis",
  "financial",
  "investment",
  "security",
  "production",
  "architecture",
];

const CAUSAL_MARKERS = [
  "causa",
  "causado",
  "gera",
  "provoca",
  "faz com que",
  "leva a",
  "resulta em",
  "cause",
  "causes",
  "caused",
  "leads to",
  "results in",
];

export function runSkepticalAdvisor(
  input: CouncilInput,
): CouncilAdvisorReport {
  const userInput = input.userInput ?? "";
  const draftAnswer = input.draftAnswer ?? "";

  const context = buildSkepticalContext(userInput, draftAnswer);
  const findings = dedupeFindings([
    ...findPremiseAcceptanceGaps(context),
    ...findCounterpointGaps(context),
    ...findAlternativeHypothesisGaps(context),
    ...findOverconfidenceGaps(context),
    ...findHighStakesGaps(context),
    ...findCausalReasoningGaps(context),
    ...findWeakSkepticalPosture(context),
  ]);

  const risk = maxRiskLevel(findings.map((finding) => finding.risk));
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

  const missingCounterpoints = dedupeNormalized(
    findings
      .map((finding) => finding.missingCounterpoint)
      .filter((counterpoint): counterpoint is string => Boolean(counterpoint)),
  );

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
              "Maintain explicit premise testing when the user presents strong claims, evaluations or high-stakes assumptions.",
            ]
          : [],
    confidence: confidenceFromSignals(findings.length, hardSignals),
    missingCounterpoints,
  };
}

function buildSkepticalContext(
  userInput: string,
  draftAnswer: string,
): SkepticalContext {
  const normalizedUser = normalizeText(userInput);
  const normalizedDraft = normalizeText(draftAnswer);

  return {
    userHasStrongPremise: containsAny(normalizedUser, STRONG_PREMISE_MARKERS),
    userRequestsEvaluation: containsAny(normalizedUser, EVALUATION_REQUEST_MARKERS),
    userRequestsVerification: containsAny(
      normalizedUser,
      VERIFICATION_REQUEST_MARKERS,
    ),
    userPresentsContestedClaim: containsAny(
      normalizedUser,
      CONTESTED_CLAIM_MARKERS,
    ),
    userTaskIsHighStakes: containsAny(normalizedUser, HIGH_STAKES_MARKERS),
    draftStartsWithAgreement: startsWithAny(
      normalizedDraft,
      AGREEMENT_FIRST_MARKERS,
    ),
    draftTestsPremise: containsAny(normalizedDraft, PREMISE_TESTING_MARKERS),
    draftHasCounterpoint: containsAny(normalizedDraft, COUNTERPOINT_MARKERS),
    draftHasAlternativeHypothesis: containsAny(
      normalizedDraft,
      ALTERNATIVE_HYPOTHESIS_MARKERS,
    ),
    draftHasUncertaintyBoundary: containsAny(
      normalizedDraft,
      UNCERTAINTY_BOUNDARY_MARKERS,
    ),
    draftHasCounterexample: containsAny(normalizedDraft, COUNTEREXAMPLE_MARKERS),
    draftClaimsSingleExplanation: containsAny(
      normalizedDraft,
      SINGLE_EXPLANATION_MARKERS,
    ),
    draftHasOverconfidentConclusion: containsAny(
      normalizedDraft,
      OVERCONFIDENT_CONCLUSION_MARKERS,
    ),
    draftHasCausalClaim: containsAny(normalizedDraft, CAUSAL_MARKERS),
  };
}

function findPremiseAcceptanceGaps(
  context: SkepticalContext,
): SkepticalFinding[] {
  const findings: SkepticalFinding[] = [];

  if (context.draftStartsWithAgreement && !context.draftTestsPremise) {
    findings.push({
      id: "agreement_first_without_premise_testing",
      risk: "high",
      message:
        "The draft begins by agreeing with the user before testing the premise.",
      requiredRevision:
        "Test the user's premise explicitly before agreeing. Separate what is valid, doubtful and unsupported.",
      missingCounterpoint:
        "Add a premise check: what would make the user's claim false, incomplete or only partially correct?",
    });
  }

  if (
    context.userPresentsContestedClaim &&
    !context.draftTestsPremise &&
    !context.draftHasCounterpoint
  ) {
    findings.push({
      id: "premise_accepted_without_testing",
      risk: "high",
      message:
        "The user presents a contested claim, but the draft does not visibly test it.",
      requiredRevision:
        "Treat the user's claim as a hypothesis to evaluate, not as the conclusion.",
      missingCounterpoint:
        "Consider whether the user's claim could be wrong, exaggerated or only partly right.",
    });
  }

  return findings;
}

function findCounterpointGaps(
  context: SkepticalContext,
): SkepticalFinding[] {
  const findings: SkepticalFinding[] = [];

  if (context.userHasStrongPremise && !context.draftHasCounterpoint) {
    findings.push({
      id: "strong_user_premise_without_counterpoint",
      risk: "medium",
      message:
        "The user states a strong premise, but the draft does not provide a meaningful counterpoint.",
      requiredRevision:
        "Add at least one strong objection, limitation or competing interpretation before the final conclusion.",
      missingCounterpoint:
        "What is the strongest reason the user's premise might not hold?",
    });
  }

  if (
    context.userRequestsEvaluation &&
    !context.draftHasCounterpoint &&
    !context.draftHasUncertaintyBoundary
  ) {
    findings.push({
      id: "evaluation_request_without_critical_tension",
      risk: "medium",
      message:
        "The user asks for evaluation, but the draft lacks critical tension or limitation marking.",
      requiredRevision:
        "Include a concrete limitation, weakness or alternative reading instead of only validating the material.",
      missingCounterpoint:
        "Add one weakness, one limit or one condition under which the assessment would change.",
    });
  }

  if (
    (context.userHasStrongPremise || context.userRequestsVerification) &&
    !context.draftHasCounterexample &&
    !context.draftHasCounterpoint
  ) {
    findings.push({
      id: "no_counterexample_considered",
      risk: "medium",
      message:
        "The draft does not consider a counterexample even though the task invites verification or strong claims.",
      optionalRevision:
        "Add a counterexample or explain why no relevant counterexample is needed.",
      missingCounterpoint:
        "Identify at least one case that could challenge the conclusion.",
    });
  }

  return findings;
}

function findAlternativeHypothesisGaps(
  context: SkepticalContext,
): SkepticalFinding[] {
  const findings: SkepticalFinding[] = [];

  if (
    context.draftClaimsSingleExplanation &&
    !context.draftHasAlternativeHypothesis
  ) {
    findings.push({
      id: "single_explanation_claim_without_comparison",
      risk: "high",
      message:
        "The draft claims or implies a single explanation without comparing alternatives.",
      requiredRevision:
        "Consider at least one alternative interpretation and explain why it is weaker, stronger or not applicable.",
      missingCounterpoint:
        "What alternative explanation could account for the same facts?",
    });
  }

  if (
    context.userPresentsContestedClaim &&
    !context.draftHasAlternativeHypothesis
  ) {
    findings.push({
      id: "alternative_hypothesis_not_considered",
      risk: "medium",
      message:
        "The draft does not consider an alternative hypothesis for a contested user claim.",
      requiredRevision:
        "Add a competing hypothesis or alternative interpretation before concluding.",
      missingCounterpoint:
        "Present one plausible alternative and compare it with the user's premise.",
    });
  }

  return findings;
}

function findOverconfidenceGaps(
  context: SkepticalContext,
): SkepticalFinding[] {
  const findings: SkepticalFinding[] = [];

  if (
    context.draftHasOverconfidentConclusion &&
    !context.draftHasCounterpoint &&
    !context.draftTestsPremise
  ) {
    findings.push({
      id: "overconfident_conclusion_without_objection",
      risk: "high",
      message:
        "The draft uses overconfident conclusion language without visible objection testing.",
      requiredRevision:
        "Reduce certainty or add the reasoning that makes the strong conclusion justified.",
      missingCounterpoint:
        "Before using certainty, state what objection was considered and why it does not defeat the conclusion.",
    });
  }

  return findings;
}

function findHighStakesGaps(context: SkepticalContext): SkepticalFinding[] {
  if (
    !context.userTaskIsHighStakes ||
    context.draftTestsPremise ||
    context.draftHasCounterpoint ||
    context.draftHasUncertaintyBoundary
  ) {
    return [];
  }

  return [
    {
      id: "high_stakes_claim_without_skeptical_check",
      risk: "high",
      message:
        "The task appears high-stakes, but the draft lacks skeptical checks or uncertainty boundaries.",
      requiredRevision:
        "Add a skeptical check, limitation or verification boundary before giving a firm recommendation.",
      missingCounterpoint:
        "State what information would change the answer or what risk should be checked before acting.",
    },
  ];
}

function findCausalReasoningGaps(context: SkepticalContext): SkepticalFinding[] {
  if (
    !context.draftHasCausalClaim ||
    context.draftHasAlternativeHypothesis ||
    context.draftHasCounterpoint ||
    context.draftTestsPremise
  ) {
    return [];
  }

  return [
    {
      id: "causal_claim_without_alternative",
      risk: "medium",
      message:
        "The draft makes a causal claim without testing alternative causes.",
      optionalRevision:
        "Add an alternative cause or clarify why the proposed cause is the best explanation.",
      missingCounterpoint:
        "Could another factor explain the same outcome?",
    },
  ];
}

function findWeakSkepticalPosture(
  context: SkepticalContext,
): SkepticalFinding[] {
  const taskNeedsSkepticism =
    context.userHasStrongPremise ||
    context.userRequestsEvaluation ||
    context.userRequestsVerification ||
    context.userPresentsContestedClaim ||
    context.userTaskIsHighStakes;

  const draftShowsSkepticism =
    context.draftTestsPremise ||
    context.draftHasCounterpoint ||
    context.draftHasAlternativeHypothesis ||
    context.draftHasUncertaintyBoundary ||
    context.draftHasCounterexample;

  if (!taskNeedsSkepticism || draftShowsSkepticism) {
    return [];
  }

  return [
    {
      id: "weak_skeptical_posture",
      risk: "medium",
      message:
        "The task calls for skeptical evaluation, but the draft does not show enough critical testing.",
      requiredRevision:
        "Add explicit premise testing, a limitation, a counterpoint or an alternative hypothesis.",
      missingCounterpoint:
        "What assumption is the answer relying on, and how could that assumption fail?",
    },
  ];
}

function buildStrengths(context: SkepticalContext): string[] {
  const strengths = ["Response includes an adequate premise-testing posture."];

  if (context.draftHasCounterpoint) {
    strengths.push("The draft includes a counterpoint or limitation.");
  }

  if (context.draftHasAlternativeHypothesis) {
    strengths.push("The draft considers an alternative hypothesis.");
  }

  if (context.draftHasUncertaintyBoundary) {
    strengths.push("The draft marks uncertainty or limitation boundaries.");
  }

  return dedupeNormalized(strengths);
}

function dedupeFindings(
  findings: readonly SkepticalFinding[],
): SkepticalFinding[] {
  const byId = new Map<SkepticalConcernId, SkepticalFinding>();

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
      missingCounterpoint:
        previous.missingCounterpoint ?? finding.missingCounterpoint,
    });
  }

  return Array.from(byId.values());
}

function containsAny(text: string, markers: readonly string[]): boolean {
  return markers.some((marker) => containsMarker(text, marker));
}

function startsWithAny(text: string, markers: readonly string[]): boolean {
  const firstChunk = text.slice(0, 180);

  return markers.some((marker) => containsMarker(firstChunk, marker));
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
