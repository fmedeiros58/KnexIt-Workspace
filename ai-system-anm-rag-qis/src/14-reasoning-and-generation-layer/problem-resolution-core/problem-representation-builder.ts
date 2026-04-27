/**
 * Layer: 14-reasoning-and-generation-layer/problem-resolution-core
 * Module: problem-representation-builder
 * Responsibility: Build an explicit intermediate representation of the user task.
 */

import type {
  LogicalProblemKind,
  ProblemRepresentation,
  ProblemResolutionInput,
  ReasoningNeed,
  ScenarioBranch,
} from "./problem-resolution-types";
import { extractActionBudget } from "./action-budget-extractor";
import { extractObservationLimits } from "./observation-limit-extractor";
import { buildDomainVariableMapping } from "./domain-variable-mapper";
import { buildProofObligations } from "./proof-obligation-builder";

interface ExtractedTerms {
  readonly entities: string[];
  readonly variables: string[];
}

interface ConstraintExtractionResult {
  readonly explicitConstraints: string[];
  readonly implicitConstraints: string[];
}

interface LogicalKindSignal {
  readonly kind: LogicalProblemKind;
  readonly score: number;
  readonly reason: string;
}

const STOPWORDS = new Set([
  "a",
  "o",
  "os",
  "as",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "ou",
  "em",
  "para",
  "por",
  "com",
  "sem",
  "um",
  "uma",
  "uns",
  "umas",
  "no",
  "na",
  "nos",
  "nas",
  "que",
  "se",
  "como",
  "qual",
  "quais",
  "isso",
  "esse",
  "essa",
  "isto",
  "este",
  "esta",
  "voce",
  "você",
  "the",
  "an",
  "and",
  "or",
  "for",
  "to",
  "of",
  "in",
  "on",
  "with",
  "without",
  "that",
  "this",
  "which",
  "what",
]);

const OUTPUT_CUES: Array<{ readonly pattern: RegExp; readonly label: string }> = [
  { pattern: /\b(compare|comparar|comparison|comparacao|comparação)\b/i, label: "comparative_output" },
  { pattern: /\b(analis[ae]|analysis|avali[ae]|evaluate|verifique|verify)\b/i, label: "evaluation_output" },
  { pattern: /\b(explique|explain|demonstr|prove|justifique|justify)\b/i, label: "explanatory_output" },
  { pattern: /\b(codigo|código|code|implement|patch|corrig|fix)\b/i, label: "implementation_output" },
  { pattern: /\b(lista|list|itens|items|topicos|tópicos)\b/i, label: "enumerated_output" },
  { pattern: /\b(resumo|summary|sintese|síntese)\b/i, label: "summary_output" },
];

const FORMAT_CUES: Array<{ readonly pattern: RegExp; readonly label: string }> = [
  { pattern: /\bjson\b/i, label: "json_format" },
  { pattern: /\bmarkdown\b/i, label: "markdown_format" },
  { pattern: /\b(bullet|lista|topicos|tópicos)\b/i, label: "bullet_points" },
  { pattern: /\b(tabela|table|quadro)\b/i, label: "table_format" },
  { pattern: /\b(passo a passo|step by step)\b/i, label: "stepwise_format" },
];

const CONSTRAINT_MARKERS = [
  "nao",
  "não",
  "nunca",
  "jamais",
  "sem",
  "apenas",
  "somente",
  "so",
  "só",
  "unica",
  "única",
  "unico",
  "único",
  "deve",
  "precisa",
  "obrigatorio",
  "obrigatório",
  "permitido",
  "proibido",
  "vedado",
  "condicao",
  "condição",
  "caso",
  "se",
  "must",
  "should",
  "cannot",
  "without",
  "only",
  "exactly",
  "required",
  "allowed",
  "forbidden",
  "if",
  "case",
];

const CONDITIONAL_MARKERS = [
  "se",
  "caso",
  "quando",
  "supondo",
  "hipotese",
  "hipótese",
  "possibilidade",
  "alternativa",
  "cenario",
  "cenário",
  "ramo",
  "if",
  "case",
  "when",
  "assuming",
  "hypothesis",
  "possibility",
  "alternative",
  "scenario",
  "branch",
];

const REASONING_MARKERS = [
  "deduz",
  "deducao",
  "dedução",
  "infer",
  "inferencia",
  "inferência",
  "eliminacao",
  "eliminação",
  "logica",
  "lógica",
  "restricao",
  "restrição",
  "constraint",
  "deduce",
  "deduction",
  "inference",
  "elimination",
  "logic",
];

const TRUTH_TABLE_MARKERS = [
  "verdadeiro",
  "falso",
  "true",
  "false",
  "proposicao",
  "proposição",
  "proposition",
  "truth table",
  "tabela verdade",
];

const ORDERING_MARKERS = [
  "ordem",
  "ordenar",
  "posição",
  "posicao",
  "rank",
  "ranking",
  "antes",
  "depois",
  "maior",
  "menor",
  "order",
  "ordering",
  "position",
  "before",
  "after",
  "greater",
  "lesser",
];

const CALCULATION_MARKERS = [
  "calcular",
  "calculo",
  "cálculo",
  "soma",
  "subtracao",
  "subtração",
  "produto",
  "razao",
  "razão",
  "porcentagem",
  "calculate",
  "sum",
  "difference",
  "product",
  "ratio",
  "percentage",
];

const COMPARISON_MARKERS = [
  "comparar",
  "comparacao",
  "comparação",
  "diferença",
  "diferenca",
  "melhor",
  "pior",
  "compare",
  "comparison",
  "difference",
  "better",
  "worse",
];

const ASSIGNMENT_MARKERS = [
  "atribuir",
  "associar",
  "mapear",
  "determinar",
  "identificar",
  "corresponde",
  "relacionar",
  "mapping",
  "assignment",
  "assign",
  "associate",
  "map",
  "determine",
  "identify",
  "corresponds",
  "relate",
];

const COUNTERPOINT_MARKERS = [
  "critica",
  "crítica",
  "contraargumento",
  "objeção",
  "objecao",
  "counterpoint",
  "counterargument",
  "objection",
];

export function buildProblemRepresentation(
  input: ProblemResolutionInput,
  reasoningNeed: ReasoningNeed,
): ProblemRepresentation {
  const userInput = normalizeWhitespace(input.userInput || "");
  const language = detectLanguage(userInput, input.languageHint);

  const actionBudget = extractActionBudget(userInput);
  const observationLimits = extractObservationLimits(userInput);
  const domainMapping = buildDomainVariableMapping(userInput);

  const extracted = extractEntitiesAndVariables(userInput, domainMapping);
  const { explicitConstraints, implicitConstraints } = extractConstraints(userInput);

  const requiredOutputs = extractRequiredOutputs(userInput);
  const formatRequirements = extractFormatRequirements(userInput);
  const unknowns = detectUnknowns(userInput);
  const taskType = deriveTaskType(userInput, reasoningNeed);

  const scenarioBranches = buildScenarioBranches({
    inputText: userInput,
    explicitConstraints,
    implicitConstraints,
    domainMappingDetected: Boolean(domainMapping),
    actionBudgetDetected: Boolean(actionBudget),
    observationLimitDetected: observationLimits.length > 0,
    domainValues: domainMapping?.domains ?? [],
  });

  const variables = dedupe([
    ...extracted.variables,
    ...(domainMapping?.variables ?? []),
  ]);

  const entities = dedupe([
    ...extracted.entities,
    ...(domainMapping?.variables ?? []),
    ...(domainMapping?.domains ?? []),
  ]);

  const logicalProblemKind = classifyLogicalProblemKind({
    text: userInput,
    reasoningNeed,
    actionBudgetDetected: Boolean(actionBudget),
    observationLimitDetected: observationLimits.length > 0,
    domainMappingDetected: Boolean(domainMapping),
    scenarioBranchCount: scenarioBranches.length,
  });

  const assumptions = dedupe([
    ...(input.detectedIntent ? [`intent:${input.detectedIntent}`] : []),
    ...(input.evidence && input.evidence.length ? ["evidence_available"] : ["evidence_limited"]),
    ...(input.draftAnswer ? ["candidate_draft_present"] : []),
  ]);

  const completionObligations = buildCompletionObligations({
    requiredOutputs,
    explicitConstraints,
    formatRequirements,
    domainMappingDetected: Boolean(domainMapping),
    scenarioBranchCount: scenarioBranches.length,
    actionBudgetDetected: Boolean(actionBudget),
    observationLimitDetected: observationLimits.length > 0,
    logicalProblemKind,
  });

  const closureRequirements = buildClosureRequirements({
    domainMappingDetected: Boolean(domainMapping),
    scenarioBranchCount: scenarioBranches.length,
    actionBudgetDetected: Boolean(actionBudget),
    observationLimitDetected: observationLimits.length > 0,
    explicitConstraintCount: explicitConstraints.length,
    logicalProblemKind,
  });

  const invariants = buildInvariants({
    actionBudgetDetected: Boolean(actionBudget),
    observationLimitDetected: observationLimits.length > 0,
    domainMappingDetected: Boolean(domainMapping),
    scenarioBranchCount: scenarioBranches.length,
    explicitConstraintCount: explicitConstraints.length,
  });

  const baseRepresentation: ProblemRepresentation = {
    userGoal: userInput.slice(0, 320),
    taskType,
    logicalProblemKind,
    entities,
    variables,
    explicitConstraints,
    implicitConstraints,
    invariants,
    requiredOutputs,
    formatRequirements,
    language,
    completionObligations,
    unknowns,
    assumptions,
    actionBudget,
    observationLimits: observationLimits.length > 0 ? observationLimits : undefined,
    domainMapping,
    scenarioBranches: scenarioBranches.length > 0 ? scenarioBranches : undefined,
    closureRequirements,
  };

  return {
    ...baseRepresentation,
    proofObligations: buildProofObligations(baseRepresentation),
  };
}

function detectLanguage(input: string, hint?: string): string {
  const normalizedHint = String(hint ?? "").toLowerCase();

  if (normalizedHint.startsWith("pt")) return "pt-BR";
  if (normalizedHint.startsWith("en")) return "en-US";
  if (normalizedHint.startsWith("es")) return "es-ES";

  const normalizedInput = normalize(input);

  const ptSignals = countMarkers(normalizedInput, [
    "nao",
    "voce",
    "como",
    "qual",
    "quais",
    "deve",
    "somente",
    "entao",
    "resposta",
    "pergunta",
  ]);

  const enSignals = countMarkers(normalizedInput, [
    "the",
    "must",
    "should",
    "if",
    "then",
    "because",
    "which",
    "what",
    "answer",
    "question",
  ]);

  const esSignals = countMarkers(normalizedInput, [
    "usted",
    "como",
    "cual",
    "debe",
    "entonces",
    "porque",
    "respuesta",
    "pregunta",
  ]);

  if (ptSignals >= enSignals && ptSignals >= esSignals && ptSignals > 0) {
    return "pt-BR";
  }

  if (enSignals >= esSignals && enSignals > 0) {
    return "en-US";
  }

  if (esSignals > 0) {
    return "es-ES";
  }

  return "pt-BR";
}

function extractEntitiesAndVariables(
  input: string,
  domainMapping?: ProblemRepresentation["domainMapping"],
): ExtractedTerms {
  const quoted = Array.from(input.matchAll(/["'`](.{1,80}?)["'`]/g))
    .map((match) => normalizeWhitespace(match[1] ?? ""))
    .filter(Boolean);

  const symbolic = Array.from(input.matchAll(/\b[A-Z][A-Z0-9_]{0,12}\b/g))
    .map((match) => match[0])
    .filter((value) => value.length <= 16);

  const rawTokens = input
    .split(/[^a-zA-ZÀ-ÿ0-9_-]+/g)
    .map((token) => token.trim())
    .filter(Boolean);

  const lexical = new Map<string, number>();

  for (const token of rawTokens) {
    const normalizedToken = normalize(token);

    if (
      !normalizedToken ||
      STOPWORDS.has(normalizedToken) ||
      normalizedToken.length < 3
    ) {
      continue;
    }

    lexical.set(normalizedToken, (lexical.get(normalizedToken) ?? 0) + 1);
  }

  const frequentTerms = Array.from(lexical.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 12)
    .map(([token]) => token);

  const variables = dedupe([
    ...symbolic,
    ...(domainMapping?.variables ?? []),
    ...rawTokens.filter((token) => isVariableLike(token)),
  ]).slice(0, 32);

  const entities = dedupe([
    ...quoted,
    ...symbolic,
    ...frequentTerms,
    ...(domainMapping?.variables ?? []),
    ...(domainMapping?.domains ?? []),
  ]).slice(0, 40);

  return {
    entities,
    variables,
  };
}

function isVariableLike(token: string): boolean {
  const normalizedToken = normalize(token);

  return (
    /^[A-Z]{1,4}$/.test(token) ||
    /^[xyzuvw]$/i.test(token) ||
    /[a-z_].*\d|\d.*[a-z_]/i.test(token) ||
    /^op(c|cao)_?\d+$/i.test(normalizedToken) ||
    /^option_?\d+$/i.test(normalizedToken) ||
    /^entity_?\d+$/i.test(normalizedToken) ||
    /^item_?\d+$/i.test(normalizedToken)
  );
}

function extractConstraints(input: string): ConstraintExtractionResult {
  const segments = splitSentences(input);
  const explicitConstraints = segments
    .filter((segment) => containsAny(segment, CONSTRAINT_MARKERS))
    .slice(0, 20);

  const implicitConstraints: string[] = [];

  if (/\?/.test(input) || containsAny(input, ["pergunta", "question"])) {
    implicitConstraints.push("must_answer_user_goal");
  }

  if (containsAny(input, ["analise", "avaliar", "analysis", "evaluate", "verifique", "verify"])) {
    implicitConstraints.push("must_provide_reasoned_judgment");
  }

  if (containsAny(input, COUNTERPOINT_MARKERS)) {
    implicitConstraints.push("must_include_counterpoint_when_relevant");
  }

  if (containsAny(input, ["codigo", "código", "implement", "fix", "corrigir", "patch"])) {
    implicitConstraints.push("must_provide_actionable_implementation");
  }

  if (containsAny(input, ["cite", "fonte", "source", "evidence", "evidencia", "evidência"])) {
    implicitConstraints.push("must_distinguish_evidence_from_assumption");
  }

  if (containsAny(input, REASONING_MARKERS)) {
    implicitConstraints.push("must_preserve_inferential_chain");
  }

  return {
    explicitConstraints: dedupe(explicitConstraints),
    implicitConstraints: dedupe(implicitConstraints),
  };
}

function extractRequiredOutputs(input: string): string[] {
  const requiredOutputs = OUTPUT_CUES
    .filter((entry) => entry.pattern.test(input))
    .map((entry) => entry.label);

  if (!requiredOutputs.length) {
    requiredOutputs.push("direct_answer");
  }

  return dedupe(requiredOutputs);
}

function extractFormatRequirements(input: string): string[] {
  return dedupe(
    FORMAT_CUES
      .filter((entry) => entry.pattern.test(input))
      .map((entry) => entry.label),
  );
}

function detectUnknowns(input: string): string[] {
  const unknowns: string[] = [];

  if (containsAny(input, ["qual", "quais", "que", "which", "what", "who", "when", "where", "why", "how"])) {
    unknowns.push("open_interrogative");
  }

  if (/\?/.test(input)) {
    unknowns.push("explicit_question");
  }

  if (containsAny(input, ["indefinid", "ambig", "uncertain", "incerto", "unknown", "desconhecido"])) {
    unknowns.push("ambiguity_declared");
  }

  return dedupe(unknowns);
}

function deriveTaskType(input: string, reasoningNeed: ReasoningNeed): string {
  const normalizedInput = normalize(input);

  if (containsAny(normalizedInput, ["codigo", "código", "implement", "debug", "patch", "corrig", "fix"])) {
    return "technical_implementation";
  }

  if (containsAny(normalizedInput, ["norma", "lei", "compliance", "regulamento", "policy", "contrato"])) {
    return "normative_interpretation";
  }

  if (containsAny(normalizedInput, ["avali", "critica", "crítica", "argument", "tese", "thesis"])) {
    return "argument_evaluation";
  }

  if (containsAny(normalizedInput, REASONING_MARKERS) || containsAny(normalizedInput, CONDITIONAL_MARKERS)) {
    return "logical_deduction";
  }

  if (reasoningNeed === "none" || reasoningNeed === "light") {
    return "direct_query";
  }

  return "multi_constraint_reasoning";
}

function classifyLogicalProblemKind(input: {
  readonly text: string;
  readonly reasoningNeed: ReasoningNeed;
  readonly actionBudgetDetected: boolean;
  readonly observationLimitDetected: boolean;
  readonly domainMappingDetected: boolean;
  readonly scenarioBranchCount: number;
}): LogicalProblemKind {
  const normalizedInput = normalize(input.text);
  const signals: LogicalKindSignal[] = [];

  addSignal(signals, "constraint_satisfaction", containsAny(normalizedInput, CONSTRAINT_MARKERS) ? 4 : 0, "constraint markers");
  addSignal(signals, "single_action_inference", input.actionBudgetDetected ? 7 : 0, "action budget");
  addSignal(signals, "observation_limited_reasoning", input.observationLimitDetected ? 7 : 0, "observation limit");
  addSignal(signals, "assignment_problem", input.domainMappingDetected ? 6 : 0, "domain mapping");
  addSignal(signals, "mapping_problem", input.domainMappingDetected && containsAny(normalizedInput, ASSIGNMENT_MARKERS) ? 7 : 0, "mapping markers");
  addSignal(signals, "case_analysis", input.scenarioBranchCount > 0 || containsAny(normalizedInput, CONDITIONAL_MARKERS) ? 5 : 0, "scenario markers");
  addSignal(signals, "deductive_elimination", containsAny(normalizedInput, ["eliminacao", "eliminação", "eliminate", "elimination", "deduz", "infer"]) ? 6 : 0, "deduction markers");
  addSignal(signals, "truth_table", containsAny(normalizedInput, TRUTH_TABLE_MARKERS) ? 6 : 0, "truth markers");
  addSignal(signals, "ordering_problem", containsAny(normalizedInput, ORDERING_MARKERS) ? 6 : 0, "ordering markers");
  addSignal(signals, "calculation_problem", containsAny(normalizedInput, CALCULATION_MARKERS) ? 6 : 0, "calculation markers");
  addSignal(signals, "comparison_problem", containsAny(normalizedInput, COMPARISON_MARKERS) ? 5 : 0, "comparison markers");

  if (
    input.actionBudgetDetected &&
    input.observationLimitDetected &&
    input.domainMappingDetected
  ) {
    addSignal(signals, "single_action_inference", 3, "combined limited inference");
  }

  if (
    input.domainMappingDetected &&
    (input.scenarioBranchCount > 0 || input.actionBudgetDetected)
  ) {
    addSignal(signals, "mapping_problem", 3, "mapping with scenarios or limited action");
  }

  const best = signals
    .filter((signal) => signal.score > 0)
    .sort((left, right) => right.score - left.score)[0];

  if (best) {
    return best.kind;
  }

  if (input.reasoningNeed !== "none" && input.reasoningNeed !== "light") {
    return "constraint_satisfaction";
  }

  return "unknown";
}

function addSignal(
  signals: LogicalKindSignal[],
  kind: LogicalProblemKind,
  score: number,
  reason: string,
): void {
  if (score <= 0) {
    return;
  }

  const existing = signals.find((signal) => signal.kind === kind);

  if (!existing) {
    signals.push({ kind, score, reason });
    return;
  }

  signals.splice(signals.indexOf(existing), 1, {
    kind,
    score: existing.score + score,
    reason: `${existing.reason}; ${reason}`,
  });
}

function buildScenarioBranches(input: {
  readonly inputText: string;
  readonly explicitConstraints: readonly string[];
  readonly implicitConstraints: readonly string[];
  readonly domainMappingDetected: boolean;
  readonly actionBudgetDetected: boolean;
  readonly observationLimitDetected: boolean;
  readonly domainValues: readonly string[];
}): ScenarioBranch[] {
  const searchableText = [
    input.inputText,
    ...input.explicitConstraints,
    ...input.implicitConstraints,
  ].join(" ");

  const conditionalBranches = extractConditionalBranches(searchableText);
  const domainBranches = inferDomainDrivenBranches(input);

  return dedupeScenarioBranches([
    ...conditionalBranches,
    ...domainBranches,
  ]).slice(0, 16);
}

function extractConditionalBranches(text: string): ScenarioBranch[] {
  const segments = splitSentences(text);
  const rawBranches: string[] = [];

  for (const segment of segments) {
    if (!containsAny(segment, CONDITIONAL_MARKERS)) {
      continue;
    }

    const conditionalSlices = segment
      .split(/(?=\bse\b|\bif\b|\bcaso\b|\bwhen\b|\bquando\b|\bsupondo\b)/i)
      .map((slice) => slice.trim())
      .filter((slice) => containsAny(slice, CONDITIONAL_MARKERS));

    if (conditionalSlices.length > 0) {
      rawBranches.push(...conditionalSlices);
      continue;
    }

    rawBranches.push(segment);
  }

  return dedupe(rawBranches).map((segment, index) =>
    makeScenarioBranch(`branch_${index + 1}`, segment),
  );
}

function inferDomainDrivenBranches(input: {
  readonly domainMappingDetected: boolean;
  readonly actionBudgetDetected: boolean;
  readonly observationLimitDetected: boolean;
  readonly domainValues: readonly string[];
}): ScenarioBranch[] {
  const shouldInferBranches =
    input.domainMappingDetected &&
    (input.actionBudgetDetected || input.observationLimitDetected) &&
    input.domainValues.length >= 2 &&
    input.domainValues.length <= 8;

  if (!shouldInferBranches) {
    return [];
  }

  return input.domainValues.map((domain, index) =>
    makeScenarioBranch(
      `observed_result_${index + 1}`,
      `observed_result_is:${domain}`,
    ),
  );
}

function makeScenarioBranch(id: string, condition: string): ScenarioBranch {
  return {
    id,
    condition,
    expectedCoverageSignals: dedupe(
      normalize(condition)
        .split(/\s+/g)
        .filter((token) => token.length >= 3)
        .slice(0, 8),
    ),
  };
}

function buildCompletionObligations(input: {
  readonly requiredOutputs: readonly string[];
  readonly explicitConstraints: readonly string[];
  readonly formatRequirements: readonly string[];
  readonly domainMappingDetected: boolean;
  readonly scenarioBranchCount: number;
  readonly actionBudgetDetected: boolean;
  readonly observationLimitDetected: boolean;
  readonly logicalProblemKind: LogicalProblemKind;
}): string[] {
  return dedupe([
    ...input.requiredOutputs,
    ...input.explicitConstraints.map((entry) => `respect:${entry.slice(0, 120)}`),
    ...(input.formatRequirements.length
      ? [`format:${input.formatRequirements.join("+")}`]
      : []),
    ...(input.domainMappingDetected
      ? ["assign_all_variables", "validate_mapping_consistency"]
      : []),
    ...(input.scenarioBranchCount > 0
      ? ["cover_all_scenario_branches"]
      : []),
    ...(input.actionBudgetDetected
      ? ["respect_action_budget"]
      : []),
    ...(input.observationLimitDetected
      ? ["respect_observation_limits"]
      : []),
    ...(input.logicalProblemKind !== "unknown"
      ? [`logical_kind:${input.logicalProblemKind}`]
      : []),
  ]);
}

function buildClosureRequirements(input: {
  readonly domainMappingDetected: boolean;
  readonly scenarioBranchCount: number;
  readonly actionBudgetDetected: boolean;
  readonly observationLimitDetected: boolean;
  readonly explicitConstraintCount: number;
  readonly logicalProblemKind: LogicalProblemKind;
}): string[] {
  return dedupe([
    ...(input.explicitConstraintCount > 0
      ? ["preserve_all_explicit_constraints"]
      : []),
    ...(input.actionBudgetDetected
      ? ["respect_action_budget"]
      : []),
    ...(input.observationLimitDetected
      ? ["respect_observation_limits"]
      : []),
    ...(input.scenarioBranchCount > 0
      ? ["cover_all_scenario_branches"]
      : []),
    ...(input.domainMappingDetected
      ? ["assign_all_variables", "validate_final_mapping", "preserve_exclusivity"]
      : []),
    ...(input.logicalProblemKind === "deductive_elimination"
      ? ["justify_elimination_steps"]
      : []),
    "support_final_conclusion",
  ]);
}

function buildInvariants(input: {
  readonly actionBudgetDetected: boolean;
  readonly observationLimitDetected: boolean;
  readonly domainMappingDetected: boolean;
  readonly scenarioBranchCount: number;
  readonly explicitConstraintCount: number;
}): string[] {
  return dedupe([
    "preserve_core_goal",
    "preserve_constraints_until_closure",
    "avoid_unjustified_assumptions",
    "cover_required_outputs",
    "respond_in_user_language",
    "avoid_repetition",
    ...(input.explicitConstraintCount > 0
      ? ["preserve_explicit_constraints"]
      : []),
    ...(input.actionBudgetDetected
      ? ["preserve_action_budget"]
      : []),
    ...(input.observationLimitDetected
      ? ["preserve_observation_limit"]
      : []),
    ...(input.domainMappingDetected
      ? ["preserve_assignment_rules", "preserve_exclusivity", "resolve_all_variables"]
      : []),
    ...(input.scenarioBranchCount > 0
      ? ["cover_required_scenarios"]
      : []),
  ]);
}

function splitSentences(text: string): string[] {
  return normalizeWhitespace(text)
    .split(/[.!?;\n]+/g)
    .map((segment) => normalizeWhitespace(segment))
    .filter(Boolean);
}

function dedupeScenarioBranches(branches: readonly ScenarioBranch[]): ScenarioBranch[] {
  const byCondition = new Map<string, ScenarioBranch>();

  for (const branch of branches) {
    const condition = normalize(branch.condition);

    if (!condition) {
      continue;
    }

    if (!byCondition.has(condition)) {
      byCondition.set(condition, branch);
    }
  }

  return Array.from(byCondition.values()).map((branch, index) => ({
    ...branch,
    id: branch.id || `branch_${index + 1}`,
    expectedCoverageSignals: dedupe(branch.expectedCoverageSignals ?? []),
  }));
}

function containsAny(text: string, markers: readonly string[]): boolean {
  const normalizedText = normalize(text);

  return markers.some((marker) => containsMarker(normalizedText, marker));
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
  return markers.reduce(
    (count, marker) => count + (containsMarker(text, marker) ? 1 : 0),
    0,
  );
}

function normalizeWhitespace(text: string): string {
  return String(text ?? "").replace(/\s+/g, " ").trim();
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

function dedupe(values: ReadonlyArray<string>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const cleaned = normalizeWhitespace(value);
    const key = normalize(cleaned);

    if (!cleaned || !key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}