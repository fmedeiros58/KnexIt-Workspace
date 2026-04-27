/**
 * Layer: 14-reasoning-and-generation-layer/problem-resolution-core
 * Module: invariant-tracker
 * Responsibility: Evaluate invariant compliance over candidate drafts.
 */

import type {
  ProblemRepresentation,
  ReasoningRisk,
} from "./problem-resolution-types";
import { detectActionBudgetViolation } from "./action-budget-extractor";
import { detectObservationLimitViolation } from "./observation-limit-extractor";
import { detectUnresolvedAssignments } from "./domain-variable-mapper";

export interface InvariantTrackerResult {
  invariants: string[];
  violatedInvariants: string[];
  risks: ReasoningRisk[];
}

type LanguageCode = "pt" | "en" | "es" | "unknown";

interface LanguageDetection {
  readonly language: LanguageCode;
  readonly confidence: number;
  readonly scores: Record<Exclude<LanguageCode, "unknown">, number>;
}

interface AssignmentAuditSnapshot {
  readonly missingVariables: string[];
  readonly unusedDomains: string[];
  readonly duplicateAssignments: string[];
  readonly violatedAssignmentRules: string[];
  readonly passed: boolean;
}

interface InvariantContext {
  readonly representation: ProblemRepresentation;
  readonly userInput: string;
  readonly draftAnswer: string;
  readonly normalizedUser: string;
  readonly normalizedDraft: string;

  readonly userLanguage: LanguageDetection;
  readonly draftLanguage: LanguageDetection;

  readonly variables: string[];
  readonly explicitConstraints: string[];
  readonly implicitConstraints: string[];
  readonly completionObligations: string[];
  readonly representationInvariants: string[];
  readonly scenarioBranches: string[];
  readonly closureRequirements: string[];

  readonly actionBudgetPresent: boolean;
  readonly observationLimitsPresent: boolean;
  readonly hasDomainMapping: boolean;

  readonly assignmentAudit: AssignmentAuditSnapshot;
  readonly actionBudgetViolation: boolean;
  readonly actionBudgetViolationReasons: string[];
  readonly observationLimitViolation: boolean;
  readonly observationLimitViolationReasons: string[];

  readonly allConstraints: string[];
  readonly allObligations: string[];
  readonly searchableFormalContext: string;
}

interface InvariantViolation {
  readonly invariant: string;
  readonly risk: ReasoningRisk;
}

const BASE_INVARIANTS = [
  "respond_in_user_language",
  "preserve_core_goal",
  "avoid_repetition",
  "avoid_premature_technical_continuation_after_farewell",
  "preserve_explicit_constraints",
  "avoid_contradictory_answer_state",
];

const OPERATION_LIMIT_MARKERS = [
  "apenas uma",
  "apenas um",
  "somente uma",
  "somente um",
  "uma unica",
  "uma unica vez",
  "um unico",
  "uma vez",
  "no maximo uma",
  "no maximo um",
  "only one",
  "one single",
  "single",
  "at most one",
  "exactly one",
  "only once",
];

const OPERATION_EXPANSION_MARKERS = [
  "repita",
  "repetir",
  "novamente",
  "de novo",
  "mais uma vez",
  "cada uma",
  "cada um",
  "uma por vez",
  "um por vez",
  "todos",
  "todas",
  "restantes",
  "demais",
  "outras",
  "outros",
  "mesmo processo",
  "mesmo procedimento",
  "mesma operacao",
  "faca o mesmo",
  "repeat",
  "again",
  "once more",
  "each",
  "one by one",
  "every",
  "all of them",
  "remaining",
  "others",
  "same process",
  "same procedure",
  "same operation",
  "do the same",
];

const OBSERVATION_LIMIT_MARKERS = [
  "sem olhar",
  "nao olhar",
  "sem ver",
  "nao ver",
  "sem observar",
  "nao observar",
  "sem verificar",
  "nao verificar",
  "sem consultar",
  "without looking",
  "without seeing",
  "without observing",
  "without checking",
  "without consulting",
  "do not look",
  "cannot look",
  "no additional observation",
];

const OBSERVATION_EXPANSION_MARKERS = [
  "olhar",
  "verificar",
  "observar",
  "checar",
  "inspecionar",
  "consultar",
  "abrir",
  "look",
  "check",
  "observe",
  "inspect",
  "consult",
  "open",
];

const EXCLUSIVITY_MARKERS = [
  "exclusivo",
  "exclusiva",
  "exclusividade",
  "mutuamente exclusivo",
  "um para um",
  "uma para uma",
  "cada valor",
  "cada item",
  "sem repetir",
  "nao repetir",
  "only once",
  "one to one",
  "one-to-one",
  "mutually exclusive",
  "without repetition",
  "no repetition",
];

const SCENARIO_MARKERS = [
  "cenario",
  "caso",
  "hipotese",
  "possibilidade",
  "alternativa",
  "ramo",
  "se",
  "quando",
  "supondo",
  "scenario",
  "case",
  "hypothesis",
  "possibility",
  "alternative",
  "branch",
  "if",
  "when",
  "assuming",
];

const ASSIGNMENT_MARKERS = [
  "atribuir",
  "associar",
  "mapear",
  "determinar",
  "identificar",
  "resolver todas",
  "resolver todos",
  "assign",
  "map",
  "determine",
  "identify",
  "resolve all",
  "mapping",
  "assignment",
];

const CLOSURE_MARKERS = [
  "conclusao",
  "concluindo",
  "portanto",
  "logo",
  "assim",
  "resultado final",
  "resposta final",
  "therefore",
  "thus",
  "in conclusion",
  "final answer",
];

const SUPPORT_MARKERS = [
  "porque",
  "pois",
  "uma vez que",
  "com base",
  "decorre",
  "premissa",
  "restricao",
  "evidencia",
  "se",
  "caso",
  "portanto",
  "logo",
  "because",
  "since",
  "based on",
  "premise",
  "constraint",
  "evidence",
  "if",
  "case",
  "therefore",
  "thus",
];

const FAREWELL_MARKERS = [
  "tchau",
  "ate mais",
  "obrigado",
  "obrigada",
  "valeu",
  "bye",
  "see you",
  "thanks",
];

const TECHNICAL_CONTINUATION_MARKERS = [
  "step",
  "algorithm",
  "implementation",
  "patch",
  "infer",
  "analysis",
  "passo",
  "algoritmo",
  "implementacao",
  "inferir",
  "analise",
  "continuando",
];

const CONTRADICTION_PAIRS: ReadonlyArray<{
  readonly id: string;
  readonly left: readonly string[];
  readonly right: readonly string[];
}> = [
  {
    id: "always_vs_never",
    left: ["sempre", "always"],
    right: ["nunca", "jamais", "never"],
  },
  {
    id: "can_vs_cannot",
    left: ["pode", "permitido", "can", "allowed"],
    right: ["nao pode", "cannot", "not allowed", "forbidden"],
  },
  {
    id: "must_vs_must_not",
    left: ["deve", "precisa", "must", "required"],
    right: ["nao deve", "must not", "not required"],
  },
  {
    id: "correct_vs_incorrect",
    left: ["correto", "certo", "correct", "right"],
    right: ["incorreto", "errado", "incorrect", "wrong"],
  },
  {
    id: "complete_vs_incomplete",
    left: ["completo", "suficiente", "complete", "sufficient"],
    right: ["incompleto", "insuficiente", "incomplete", "insufficient"],
  },
];

const NEGATION_MARKERS = [
  "nao",
  "sem",
  "nunca",
  "jamais",
  "proibido",
  "vedado",
  "cannot",
  "must not",
  "do not",
  "dont",
  "without",
  "never",
  "forbidden",
  "not allowed",
  "not",
];

export function trackInvariants(
  representation: ProblemRepresentation,
  userInput: string,
  draftAnswer: string,
): InvariantTrackerResult {
  const context = buildInvariantContext(representation, userInput, draftAnswer);

  const invariants = dedupe([
    ...context.representationInvariants,
    ...BASE_INVARIANTS,
    ...deriveStructuralInvariants(context),
  ]);

  const violations = dedupeViolations([
    ...checkLanguageInvariant(context),
    ...checkCoreGoalInvariant(context),
    ...checkRepetitionInvariant(context),
    ...checkFarewellInvariant(context),
    ...checkConstraintInvariants(context),
    ...checkScenarioInvariants(context),
    ...checkVariableAssignmentInvariants(context),
    ...checkContradictionInvariants(context),
    ...checkConclusionSupportInvariant(context),
    ...checkCustomRepresentationInvariants(context),
  ]);

  return {
    invariants,
    violatedInvariants: violations.map((violation) => violation.invariant),
    risks: violations.map((violation) => violation.risk),
  };
}

function buildInvariantContext(
  representation: ProblemRepresentation,
  userInput: string,
  draftAnswer: string,
): InvariantContext {
  const explicitConstraints = safeStringArray(representation.explicitConstraints);
  const implicitConstraints = safeStringArray(representation.implicitConstraints);
  const completionObligations = safeStringArray(
    representation.completionObligations,
  );
  const representationInvariants = safeStringArray(representation.invariants);
  const variables = safeStringArray(representation.variables);
  const scenarioBranches = extractScenarioBranchSignals(representation);
  const closureRequirements = getStringArrayProperty(
    representation,
    "closureRequirements",
  );

  const assignmentAudit = safeDetectUnresolvedAssignments(
    representation.domainMapping,
    draftAnswer,
  );

  const actionBudgetAudit = safeDetectActionBudgetViolation(
    representation.actionBudget,
    draftAnswer,
  );

  const observationLimitAudit = safeDetectObservationLimitViolation(
    representation.observationLimits,
    draftAnswer,
  );

  const allConstraints = dedupe([
    ...explicitConstraints,
    ...implicitConstraints,
    ...representationInvariants,
  ]);

  const allObligations = dedupe([
    ...completionObligations,
    ...closureRequirements,
  ]);

  const searchableFormalContext = normalize(
    [
      ...allConstraints,
      ...allObligations,
      ...scenarioBranches,
      ...serializeActionBudget(representation.actionBudget),
      ...serializeObservationLimits(representation.observationLimits),
      ...serializeDomainMapping(representation.domainMapping),
    ].join(" "),
  );

  return {
    representation,
    userInput: String(userInput ?? ""),
    draftAnswer: String(draftAnswer ?? ""),
    normalizedUser: normalize(userInput),
    normalizedDraft: normalize(draftAnswer),

    userLanguage: detectLanguage(userInput),
    draftLanguage: detectLanguage(draftAnswer),

    variables,
    explicitConstraints,
    implicitConstraints,
    completionObligations,
    representationInvariants,
    scenarioBranches,
    closureRequirements,

    actionBudgetPresent: Boolean(representation.actionBudget),
    observationLimitsPresent: Array.isArray(representation.observationLimits)
      ? representation.observationLimits.length > 0
      : false,
    hasDomainMapping: Boolean(representation.domainMapping),

    assignmentAudit,
    actionBudgetViolation: actionBudgetAudit.violated,
    actionBudgetViolationReasons: actionBudgetAudit.reasons,
    observationLimitViolation: observationLimitAudit.violated,
    observationLimitViolationReasons: observationLimitAudit.reasons,

    allConstraints,
    allObligations,
    searchableFormalContext,
  };
}

function deriveStructuralInvariants(context: InvariantContext): string[] {
  const invariants: string[] = [];

  if (
    context.actionBudgetPresent ||
    containsAny(context.searchableFormalContext, OPERATION_LIMIT_MARKERS)
  ) {
    invariants.push("preserve_action_budget");
  }

  if (
    context.observationLimitsPresent ||
    containsAny(context.searchableFormalContext, OBSERVATION_LIMIT_MARKERS)
  ) {
    invariants.push("preserve_observation_limit");
  }

  if (containsAny(context.searchableFormalContext, EXCLUSIVITY_MARKERS)) {
    invariants.push("preserve_exclusivity");
  }

  if (
    context.scenarioBranches.length > 0 ||
    containsAny(context.searchableFormalContext, SCENARIO_MARKERS)
  ) {
    invariants.push("cover_required_scenarios");
  }

  if (
    context.variables.length > 0 &&
    (context.hasDomainMapping ||
      containsAny(context.searchableFormalContext, ASSIGNMENT_MARKERS))
  ) {
    invariants.push("resolve_all_variables");
  }

  return invariants;
}

function checkLanguageInvariant(
  context: InvariantContext,
): InvariantViolation[] {
  const { userLanguage, draftLanguage } = context;

  if (
    userLanguage.language === "unknown" ||
    draftLanguage.language === "unknown"
  ) {
    return [];
  }

  if (
    userLanguage.language !== draftLanguage.language &&
    userLanguage.confidence >= 0.45 &&
    draftLanguage.confidence >= 0.45
  ) {
    return [
      {
        invariant: "respond_in_user_language",
        risk: {
          type: "language_shift",
          severity: "high",
          message: `Language shifted from ${userLanguage.language} to ${draftLanguage.language}.`,
        },
      },
    ];
  }

  return [];
}

function checkCoreGoalInvariant(
  context: InvariantContext,
): InvariantViolation[] {
  const userGoal = getStringProperty(context.representation, "userGoal");
  const normalizedGoal = normalize(userGoal);

  if (!normalizedGoal || !context.normalizedDraft) {
    return [];
  }

  const goalTerms = extractSalientTerms(normalizedGoal);
  const matchedTerms = goalTerms.filter((term) =>
    context.normalizedDraft.includes(term),
  );

  const coverage =
    goalTerms.length === 0
      ? 1
      : matchedTerms.length / Math.max(1, goalTerms.length);

  if (
    coverage < 0.16 &&
    !hasSemanticOverlap(normalizedGoal, context.normalizedDraft, 0.18)
  ) {
    return [
      {
        invariant: "preserve_core_goal",
        risk: {
          type: "category_shift",
          severity: "medium",
          message:
            "Draft appears semantically detached from the original user goal.",
        },
      },
    ];
  }

  return [];
}

function checkRepetitionInvariant(
  context: InvariantContext,
): InvariantViolation[] {
  if (hasRepeatedBlocks(context.draftAnswer)) {
    return [
      {
        invariant: "avoid_repetition",
        risk: {
          type: "loop_or_repetition",
          severity: "high",
          message: "Detected repeated paragraph blocks in the candidate draft.",
        },
      },
    ];
  }

  if (hasRepeatedSentences(context.draftAnswer)) {
    return [
      {
        invariant: "avoid_repetition",
        risk: {
          type: "loop_or_repetition",
          severity: "medium",
          message:
            "Detected repeated sentence-level content in the candidate draft.",
        },
      },
    ];
  }

  if (hasNearDuplicateBlocks(context.draftAnswer)) {
    return [
      {
        invariant: "avoid_repetition",
        risk: {
          type: "loop_or_repetition",
          severity: "medium",
          message:
            "Detected near-duplicate paragraph blocks in the candidate draft.",
        },
      },
    ];
  }

  return [];
}

function checkFarewellInvariant(
  context: InvariantContext,
): InvariantViolation[] {
  if (
    containsAny(context.normalizedUser, FAREWELL_MARKERS) &&
    containsAny(context.normalizedDraft, TECHNICAL_CONTINUATION_MARKERS)
  ) {
    return [
      {
        invariant: "avoid_premature_technical_continuation_after_farewell",
        risk: {
          type: "premature_closure",
          severity: "medium",
          message:
            "Draft continues technical reasoning after a farewell-like user turn.",
        },
      },
    ];
  }

  return [];
}

function checkConstraintInvariants(
  context: InvariantContext,
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  if (context.actionBudgetPresent && context.actionBudgetViolation) {
    violations.push({
      invariant: "preserve_action_budget",
      risk: {
        type: "abandoned_constraint",
        severity: "high",
        message:
          `Formal operation budget violated: ${context.actionBudgetViolationReasons.join(
            " | ",
          )}`,
      },
    });
  }

  if (context.observationLimitsPresent && context.observationLimitViolation) {
    violations.push({
      invariant: "preserve_observation_limit",
      risk: {
        type: "abandoned_constraint",
        severity: "high",
        message:
          `Formal observation limit violated: ${context.observationLimitViolationReasons.join(
            " | ",
          )}`,
      },
    });
  }

  if (
    !context.actionBudgetPresent &&
    containsAny(context.searchableFormalContext, OPERATION_LIMIT_MARKERS) &&
    containsAny(context.normalizedDraft, OPERATION_EXPANSION_MARKERS)
  ) {
    violations.push({
      invariant: "preserve_action_budget",
      risk: {
        type: "abandoned_constraint",
        severity: "high",
        message:
          "Draft appears to expand a limited operation into repeated, sequential, universal or multi-target operations.",
      },
    });
  }

  if (
    !context.observationLimitsPresent &&
    containsAny(context.searchableFormalContext, OBSERVATION_LIMIT_MARKERS)
  ) {
    const observationViolation = splitSentences(context.normalizedDraft).some(
      (sentence) =>
        containsAny(sentence, OBSERVATION_EXPANSION_MARKERS) &&
        !hasLocalNegation(sentence),
    );

    if (observationViolation) {
      violations.push({
        invariant: "preserve_observation_limit",
        risk: {
          type: "abandoned_constraint",
          severity: "high",
          message:
            "Draft appears to require observation, checking or inspection that the task forbids.",
        },
      });
    }
  }

  if (
    containsAny(context.searchableFormalContext, EXCLUSIVITY_MARKERS) &&
    detectPossibleExclusivityBreak(context.normalizedDraft)
  ) {
    violations.push({
      invariant: "preserve_exclusivity",
      risk: {
        type: "abandoned_constraint",
        severity: "medium",
        message:
          "Draft appears to reuse, duplicate or collapse distinct assignments despite an exclusivity invariant.",
      },
    });
  }

  if (context.assignmentAudit.violatedAssignmentRules.length > 0) {
    violations.push({
      invariant: "preserve_assignment_rules",
      risk: {
        type: "unsupported_conclusion",
        severity: "high",
        message: `Assignment rule violations detected: ${context.assignmentAudit.violatedAssignmentRules.join(
          " | ",
        )}`,
      },
    });
  }

  for (const constraint of context.explicitConstraints) {
    if (
      isRequiredPresenceConstraint(constraint) &&
      !hasSemanticOverlap(constraint, context.normalizedDraft, 0.16)
    ) {
      violations.push({
        invariant: "preserve_explicit_constraints",
        risk: {
          type: "abandoned_constraint",
          severity: "medium",
          message: `Explicit constraint may have been dropped: ${constraint}`,
        },
      });
    }
  }

  return violations;
}

function checkScenarioInvariants(
  context: InvariantContext,
): InvariantViolation[] {
  const scenarioRequired =
    context.scenarioBranches.length > 0 ||
    containsAny(context.searchableFormalContext, SCENARIO_MARKERS);

  if (!scenarioRequired) {
    return [];
  }

  if (context.scenarioBranches.length > 0) {
    const missingBranches = context.scenarioBranches.filter(
      (branch) => !hasSemanticOverlap(branch, context.normalizedDraft, 0.22),
    );

    if (missingBranches.length > 0) {
      return [
        {
          invariant: "cover_required_scenarios",
          risk: {
            type: "incomplete_case_analysis",
            severity: missingBranches.length > 1 ? "high" : "medium",
            message: `Scenario branches not covered: ${missingBranches.join(
              " | ",
            )}`,
          },
        },
      ];
    }

    return [];
  }

  const scenarioMarkersInDraft = countMarkers(
    context.normalizedDraft,
    SCENARIO_MARKERS,
  );

  if (scenarioMarkersInDraft < 2) {
    return [
      {
        invariant: "cover_required_scenarios",
        risk: {
          type: "incomplete_case_analysis",
          severity: "medium",
          message:
            "Scenario obligation detected, but draft does not enumerate enough scenario branches.",
        },
      },
    ];
  }

  return [];
}

function checkVariableAssignmentInvariants(
  context: InvariantContext,
): InvariantViolation[] {
  const assignmentRequired =
    context.variables.length > 0 &&
    (context.hasDomainMapping ||
      containsAny(context.searchableFormalContext, ASSIGNMENT_MARKERS));

  if (!assignmentRequired) {
    return [];
  }

  const unresolvedVariables =
    context.assignmentAudit.missingVariables.length > 0
      ? context.assignmentAudit.missingVariables
      : context.variables.filter(
          (variable) =>
            !hasSemanticOverlap(variable, context.normalizedDraft, 0.22),
        );

  if (unresolvedVariables.length === 0) {
    return [];
  }

  return [
    {
      invariant: "resolve_all_variables",
      risk: {
        type: "unresolved_variable",
        severity: unresolvedVariables.length > 2 ? "high" : "medium",
        message: `Variables not resolved in draft: ${unresolvedVariables.join(
          ", ",
        )}`,
      },
    },
  ];
}

function checkContradictionInvariants(
  context: InvariantContext,
): InvariantViolation[] {
  const contradictions: string[] = [];

  for (const pair of CONTRADICTION_PAIRS) {
    if (
      containsAny(context.normalizedDraft, pair.left) &&
      containsAny(context.normalizedDraft, pair.right)
    ) {
      contradictions.push(pair.id);
    }
  }

  if (contradictions.length === 0) {
    return [];
  }

  return [
    {
      invariant: "avoid_contradictory_answer_state",
      risk: {
        type: "unsupported_conclusion",
        severity: contradictions.length > 1 ? "high" : "medium",
        message: `Contradictory answer signals detected: ${contradictions.join(
          ", ",
        )}`,
      },
    },
  ];
}

function checkConclusionSupportInvariant(
  context: InvariantContext,
): InvariantViolation[] {
  const hasConclusion = containsAny(context.normalizedDraft, CLOSURE_MARKERS);

  if (!hasConclusion) {
    return [];
  }

  const hasSupport = containsAny(context.normalizedDraft, SUPPORT_MARKERS);

  if (!hasSupport && context.allConstraints.length > 0) {
    return [
      {
        invariant: "conclusion_must_follow_from_constraints",
        risk: {
          type: "unsupported_conclusion",
          severity: "medium",
          message:
            "Draft gives a conclusion but does not visibly connect it to premises, constraints or scenario reasoning.",
        },
      },
    ];
  }

  return [];
}

function checkCustomRepresentationInvariants(
  context: InvariantContext,
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  for (const invariant of context.representationInvariants) {
    const normalizedInvariant = normalize(invariant);

    if (!normalizedInvariant || isSymbolicInvariant(invariant)) {
      continue;
    }

    if (BASE_INVARIANTS.includes(invariant)) {
      continue;
    }

    if (
      containsAny(normalizedInvariant, OPERATION_LIMIT_MARKERS) &&
      containsAny(context.normalizedDraft, OPERATION_EXPANSION_MARKERS)
    ) {
      violations.push({
        invariant,
        risk: {
          type: "abandoned_constraint",
          severity: "high",
          message: `Custom operation-budget invariant appears violated: ${invariant}`,
        },
      });

      continue;
    }

    if (
      containsAny(normalizedInvariant, OBSERVATION_LIMIT_MARKERS) &&
      containsAny(context.normalizedDraft, OBSERVATION_EXPANSION_MARKERS)
    ) {
      violations.push({
        invariant,
        risk: {
          type: "abandoned_constraint",
          severity: "high",
          message: `Custom observation-limit invariant appears violated: ${invariant}`,
        },
      });

      continue;
    }

    if (
      isRequiredPresenceConstraint(invariant) &&
      !hasSemanticOverlap(invariant, context.normalizedDraft, 0.16)
    ) {
      violations.push({
        invariant,
        risk: {
          type: "abandoned_constraint",
          severity: "medium",
          message: `Custom invariant may have been dropped: ${invariant}`,
        },
      });
    }
  }

  return violations;
}

function safeDetectUnresolvedAssignments(
  domainMapping: ProblemRepresentation["domainMapping"],
  draftAnswer: string,
): AssignmentAuditSnapshot {
  try {
    const result = detectUnresolvedAssignments(domainMapping, draftAnswer);

    return {
      missingVariables: safeStringArray(result?.missingVariables),
      unusedDomains: safeStringArray(result?.unusedDomains),
      duplicateAssignments: safeStringArray(result?.duplicateAssignments),
      violatedAssignmentRules: safeStringArray(result?.violatedAssignmentRules),
      passed: Boolean(result?.passed),
    };
  } catch {
    return {
      missingVariables: [],
      unusedDomains: [],
      duplicateAssignments: [],
      violatedAssignmentRules: [],
      passed: true,
    };
  }
}

function safeDetectActionBudgetViolation(
  actionBudget: ProblemRepresentation["actionBudget"],
  draftAnswer: string,
): { violated: boolean; reasons: string[] } {
  try {
    const result = detectActionBudgetViolation(actionBudget, draftAnswer);

    return {
      violated: Boolean(result?.violated),
      reasons: safeStringArray(result?.reasons),
    };
  } catch {
    return {
      violated: false,
      reasons: [],
    };
  }
}

function safeDetectObservationLimitViolation(
  observationLimits: ProblemRepresentation["observationLimits"],
  draftAnswer: string,
): { violated: boolean; reasons: string[] } {
  try {
    const result = detectObservationLimitViolation(observationLimits, draftAnswer);

    return {
      violated: Boolean(result?.violated),
      reasons: safeStringArray(result?.reasons),
    };
  } catch {
    return {
      violated: false,
      reasons: [],
    };
  }
}

function detectLanguage(text: string): LanguageDetection {
  const normalized = normalize(text);

  const scores = {
    pt: countMarkers(normalized, [
      "nao",
      "voce",
      "entao",
      "porque",
      "qual",
      "quais",
      "deve",
      "explique",
      "portugues",
      "recomendacao",
      "riscos",
      "resposta",
    ]),
    en: countMarkers(normalized, [
      "the",
      "must",
      "should",
      "because",
      "which",
      "what",
      "therefore",
      "this",
      "with",
      "final",
      "recommendation",
      "answer",
    ]),
    es: countMarkers(normalized, [
      "usted",
      "porque",
      "entonces",
      "debe",
      "cual",
      "quien",
      "respuesta",
    ]),
  };

  const ranked = Object.entries(scores).sort(
    (left, right) => right[1] - left[1],
  ) as Array<["pt" | "en" | "es", number]>;

  const [bestLanguage, bestScore] = ranked[0];
  const [, secondBestScore] = ranked[1];

  if (bestScore <= 0) {
    return {
      language: "unknown",
      confidence: 0,
      scores,
    };
  }

  return {
    language: bestLanguage,
    confidence: round((bestScore - secondBestScore + 1) / (bestScore + 1), 3),
    scores,
  };
}

function extractScenarioBranchSignals(
  representation: ProblemRepresentation,
): string[] {
  const scenarioBranches = representation.scenarioBranches ?? [];

  const formalSignals = scenarioBranches.flatMap((branch) => {
    const record = branch as unknown as Record<string, unknown>;

    return [
      getRecordString(record, "id"),
      getRecordString(record, "condition"),
      ...getRecordStringArray(record, "expectedCoverageSignals"),
    ];
  });

  return dedupe([
    ...formalSignals,
    ...getStringArrayProperty(representation, "scenarios"),
  ]);
}

function serializeActionBudget(
  actionBudget: ProblemRepresentation["actionBudget"],
): string[] {
  if (!actionBudget || typeof actionBudget !== "object") {
    return [];
  }

  return dedupe([
    numberSignal("maxActions", actionBudget.maxActions),
    numberSignal("targetLimit", actionBudget.targetLimit),
    booleanSignal("repeatAllowed", actionBudget.repeatAllowed),
    typeof actionBudget.actionType === "string" ? actionBudget.actionType : "",
    ...safeStringArray(actionBudget.rawSignals),
  ]);
}

function serializeObservationLimits(
  observationLimits: ProblemRepresentation["observationLimits"],
): string[] {
  if (!Array.isArray(observationLimits)) {
    return [];
  }

  return dedupe(
    observationLimits.flatMap((item) => {
      const record = item as unknown as Record<string, unknown>;

      return [
        getRecordString(record, "type"),
        getRecordString(record, "scope"),
        ...getRecordStringArray(record, "rawSignals"),
      ];
    }),
  );
}

function serializeDomainMapping(
  domainMapping: ProblemRepresentation["domainMapping"],
): string[] {
  if (!domainMapping || typeof domainMapping !== "object") {
    return [];
  }

  return dedupe([
    ...safeStringArray(domainMapping.variables),
    ...safeStringArray(domainMapping.domains),
    ...safeStringArray(domainMapping.assignmentRules),
  ]);
}

function hasRepeatedBlocks(text: string): boolean {
  const paragraphs = String(text ?? "")
    .split(/\n{2,}/g)
    .map((paragraph) => normalize(paragraph))
    .filter((paragraph) => paragraph.length >= 35);

  if (paragraphs.length < 2) {
    return false;
  }

  const seen = new Set<string>();

  for (const paragraph of paragraphs) {
    if (seen.has(paragraph)) {
      return true;
    }

    seen.add(paragraph);
  }

  return false;
}

function hasRepeatedSentences(text: string): boolean {
  const sentences = splitSentences(text)
    .map((sentence) => normalize(sentence))
    .filter((sentence) => sentence.length >= 28);

  if (sentences.length < 3) {
    return false;
  }

  const seen = new Set<string>();

  for (const sentence of sentences) {
    if (seen.has(sentence)) {
      return true;
    }

    seen.add(sentence);
  }

  return false;
}

function hasNearDuplicateBlocks(text: string): boolean {
  const paragraphs = String(text ?? "")
    .split(/\n{2,}/g)
    .map((paragraph) => normalize(paragraph))
    .filter((paragraph) => paragraph.length >= 48);

  if (paragraphs.length < 2) {
    return false;
  }

  for (let index = 0; index < paragraphs.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < paragraphs.length; nextIndex += 1) {
      const similarity = jaccardSimilarity(
        tokenize(paragraphs[index]),
        tokenize(paragraphs[nextIndex]),
      );

      if (similarity >= 0.88) {
        return true;
      }
    }
  }

  return false;
}

function detectPossibleExclusivityBreak(normalizedDraft: string): boolean {
  return (
    /\b(mesmo valor|mesma opcao|valor repetido|opcao repetida|same value|same option|duplicate|repeated value)\b/.test(
      normalizedDraft,
    ) && !hasLocalNegation(normalizedDraft)
  );
}

function isRequiredPresenceConstraint(value: string): boolean {
  return /\b(deve|precisa|obrigatorio|must|should|required|preserve|preservar|respect|respeitar)\b/.test(
    normalize(value),
  );
}

function isSymbolicInvariant(value: string): boolean {
  return /^[a-z0-9_:-]+$/i.test(String(value ?? "").trim());
}

function extractSalientTerms(text: string): string[] {
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
    "fazer",
    "criar",
    "melhorar",
    "codigo",
    "arquivo",
    "resposta",
    "texto",
    "seguinte",
    "minha",
    "meu",
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
    tokenize(text)
      .map((term) => term.trim())
      .filter((term) => term.length >= 5 && !stopwords.has(term)),
  ).slice(0, 18);
}

function hasSemanticOverlap(
  candidate: string,
  reference: string,
  minOverlap = 0.3,
): boolean {
  const candidateTokens = new Set(tokenize(candidate));
  const referenceTokens = new Set(tokenize(reference));

  if (!candidateTokens.size || !referenceTokens.size) {
    return false;
  }

  let overlap = 0;

  for (const token of candidateTokens) {
    if (referenceTokens.has(token)) {
      overlap += 1;
    }
  }

  return (
    overlap / Math.max(1, Math.min(candidateTokens.size, referenceTokens.size)) >=
    minOverlap
  );
}

function containsAny(text: string, markers: readonly string[]): boolean {
  const normalized = normalize(text);

  return markers.some((marker) => containsMarker(normalized, marker));
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

  return new RegExp(`\\b${escapeRegExp(normalizedMarker)}\\b`).test(
    normalizedText,
  );
}

function countMarkers(text: string, markers: readonly string[]): number {
  const normalized = normalize(text);

  return markers.reduce(
    (count, marker) => count + (containsMarker(normalized, marker) ? 1 : 0),
    0,
  );
}

function hasLocalNegation(sentence: string): boolean {
  return containsAny(sentence, NEGATION_MARKERS);
}

function splitSentences(text: string): string[] {
  return normalize(text)
    .split(/[.!?;:\n]+/g)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(/\s+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function jaccardSimilarity(
  left: readonly string[],
  right: readonly string[],
): number {
  const leftSet = new Set(left);
  const rightSet = new Set(right);

  if (leftSet.size === 0 && rightSet.size === 0) {
    return 1;
  }

  const intersection = [...leftSet].filter((token) =>
    rightSet.has(token),
  ).length;

  const union = new Set([...leftSet, ...rightSet]).size;

  return intersection / Math.max(1, union);
}

function getStringProperty(source: unknown, key: string): string {
  if (!isRecord(source)) {
    return "";
  }

  const value = source[key];

  return typeof value === "string" ? value : "";
}

function getStringArrayProperty(source: unknown, key: string): string[] {
  if (!isRecord(source)) {
    return [];
  }

  return safeStringArray(source[key] as readonly unknown[] | undefined);
}

function getRecordString(source: Record<string, unknown>, key: string): string {
  const value = source[key];

  return typeof value === "string" ? value : "";
}

function getRecordStringArray(
  source: Record<string, unknown>,
  key: string,
): string[] {
  return safeStringArray(source[key] as readonly unknown[] | undefined);
}

function numberSignal(label: string, value: unknown): string {
  return typeof value === "number" && Number.isFinite(value)
    ? `${label}=${value}`
    : "";
}

function booleanSignal(label: string, value: unknown): string {
  return typeof value === "boolean" ? `${label}=${value}` : "";
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

function dedupeViolations(
  violations: readonly InvariantViolation[],
): InvariantViolation[] {
  const byInvariant = new Map<string, InvariantViolation>();

  for (const violation of violations) {
    const key = normalize(violation.invariant);
    const previous = byInvariant.get(key);

    if (!previous) {
      byInvariant.set(key, violation);
      continue;
    }

    byInvariant.set(key, {
      invariant: previous.invariant,
      risk: moreSevereRisk(previous.risk, violation.risk),
    });
  }

  return Array.from(byInvariant.values());
}

function moreSevereRisk(
  left: ReasoningRisk,
  right: ReasoningRisk,
): ReasoningRisk {
  return riskRank(right.severity) > riskRank(left.severity) ? right : left;
}

function riskRank(severity: ReasoningRisk["severity"]): number {
  if (severity === "high") return 2;
  if (severity === "medium") return 1;
  return 0;
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

function normalize(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s_.:-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function round(value: number, decimals = 3): number {
  const factor = 10 ** Math.max(0, Math.floor(decimals));

  return Math.round(value * factor) / factor;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}