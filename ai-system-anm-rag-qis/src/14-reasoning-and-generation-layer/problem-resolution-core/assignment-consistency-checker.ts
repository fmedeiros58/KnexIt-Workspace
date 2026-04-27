/**
 * Layer: 14-reasoning-and-generation-layer/problem-resolution-core
 * Module: assignment-consistency-checker
 * Responsibility: Validate final assignment consistency for generic mapping tasks.
 */

import type {
  AssignmentConsistencyResult,
  DomainMapping,
  ScenarioBranch,
} from "./problem-resolution-types";
import { detectUnresolvedAssignments } from "./domain-variable-mapper";

interface AssignmentCheckInput {
  readonly domainMapping?: DomainMapping;
  readonly draftAnswer: string;
  readonly explicitConstraints?: string[];
  readonly scenarioBranches?: ScenarioBranch[];
}

interface DetectorResult {
  readonly missingVariables: string[];
  readonly unusedDomains: string[];
  readonly duplicateAssignments: string[];
  readonly violatedAssignmentRules: string[];
}

interface AssignmentEvidenceResult {
  readonly assignments: Record<string, string>;
  readonly evidence: Record<string, string[]>;
}

interface BranchAssignmentCoverage {
  readonly branchId: string;
  readonly assignedVariables: string[];
  readonly missingVariables: string[];
  readonly duplicateAssignments: string[];
  readonly violatedRules: string[];
  readonly evidence: string[];
  readonly passed: boolean;
}

interface DiagnosticAssignmentConsistencyResult extends AssignmentConsistencyResult {
  extractedAssignments?: Record<string, string>;
  branchAssignmentCoverage?: BranchAssignmentCoverage[];
  unassignedByBranch?: Record<string, string[]>;
  assignmentEvidence?: Record<string, string[]>;
  unusedDomains?: string[];
}

interface AssignmentContext {
  readonly domainMapping?: DomainMapping;
  readonly draftAnswer: string;
  readonly normalizedDraft: string;
  readonly explicitConstraints: string[];
  readonly normalizedConstraints: string;
  readonly scenarioBranches: ScenarioBranch[];
  readonly variables: string[];
  readonly domains: string[];
  readonly assignmentRules: string[];
  readonly formalAssignments: Record<string, string>;
  readonly unresolvedFromMapper: DetectorResult;
  readonly globalAssignmentEvidence: AssignmentEvidenceResult;
}

const EXCLUSIVITY_MARKERS = [
  "exclusive",
  "exclusivo",
  "exclusiva",
  "exclusividade",
  "sem repetir",
  "nao repetir",
  "não repetir",
  "without repetition",
  "no repetition",
  "one to one",
  "one-to-one",
  "mutually exclusive",
  "cada valor",
  "cada dominio",
  "cada domínio",
  "cada item",
  "usado uma vez",
  "used once",
];

const COMPLETE_ASSIGNMENT_MARKERS = [
  "determinar todos",
  "determinar todas",
  "identificar todos",
  "identificar todas",
  "resolver todos",
  "resolver todas",
  "mapear todos",
  "mapear todas",
  "atribuir todos",
  "atribuir todas",
  "associar todos",
  "associar todas",
  "complete mapping",
  "determine all",
  "identify all",
  "resolve all",
  "assign all",
  "map all",
];

const DOMAIN_USAGE_MARKERS = [
  "todos os valores",
  "todas as opcoes",
  "todas as opções",
  "todos os dominios",
  "todos os domínios",
  "cada valor",
  "cada opção",
  "cada opcao",
  "all values",
  "all options",
  "all domains",
  "each value",
  "each option",
];

const CONDITIONAL_MARKERS = [
  "se",
  "caso",
  "quando",
  "supondo",
  "cenario",
  "cenário",
  "hipotese",
  "hipótese",
  "possibilidade",
  "alternativa",
  "if",
  "case",
  "when",
  "assuming",
  "scenario",
  "hypothesis",
  "possibility",
  "alternative",
];

const ASSIGNMENT_RELATION_MARKERS = [
  "->",
  "=>",
  "=",
  ":",
  "corresponde a",
  "recebe",
  "fica com",
  "fica sendo",
  "mapeia para",
  "atribuido a",
  "atribuído a",
  "associado a",
  "associada a",
  "contem",
  "contém",
  "e",
  "é",
  "eh",
  "sera",
  "será",
  "maps to",
  "assigned to",
  "corresponds to",
  "contains",
  "is",
  "will be",
];

const PROMISE_WITHOUT_ASSIGNMENT_MARKERS = [
  "pode ser determinado",
  "podem ser determinados",
  "podem ser determinadas",
  "pode ser descoberto",
  "podem ser descobertos",
  "podem ser descobertas",
  "basta eliminar",
  "por eliminacao",
  "por eliminação",
  "o restante fica claro",
  "o resto fica claro",
  "voce sabera",
  "você saberá",
  "can be determined",
  "can be discovered",
  "by elimination",
  "the rest follows",
  "the rest is clear",
];

const NEGATION_MARKERS = [
  "nao",
  "não",
  "sem",
  "nunca",
  "jamais",
  "cannot",
  "must not",
  "without",
  "never",
  "not",
];

const GENERIC_BRANCH_ID_PATTERN =
  /^(branch|scenario|case|ramo|cenario|cenário|observed_result|result|option|opcao|opção|domain_scenario|conditional_scenario|alternative_scenario)[_-]?\d+$/i;

const GENERIC_SIGNAL_TOKENS = new Set([
  "se",
  "caso",
  "quando",
  "supondo",
  "hipotese",
  "possibilidade",
  "alternativa",
  "cenario",
  "ramo",
  "branch",
  "scenario",
  "case",
  "if",
  "when",
  "assuming",
  "hypothesis",
  "possibility",
  "alternative",
  "condition",
  "result",
  "observed",
  "observation",
  "possible",
  "value",
  "domain",
  "entity",
  "item",
  "option",
  "opcao",
  "opcoes",
  "opção",
  "opções",
  "valor",
  "valores",
  "dominio",
  "dominios",
  "domínio",
  "domínios",
  "resultado",
  "resultados",
  "observado",
  "observada",
]);

const STOPWORDS = new Set([
  "a",
  "o",
  "as",
  "os",
  "um",
  "uma",
  "uns",
  "umas",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "para",
  "por",
  "com",
  "sem",
  "que",
  "e",
  "ou",
  "the",
  "an",
  "and",
  "or",
  "to",
  "of",
  "in",
  "on",
  "with",
  "without",
  "that",
  "this",
]);

export function checkAssignmentConsistency(
  input: AssignmentCheckInput,
): AssignmentConsistencyResult {
  const context = buildAssignmentContext(input);

  if (!context.domainMapping) {
    return {
      allVariablesAssigned: true,
      duplicateAssignments: [],
      missingAssignments: [],
      violatedAssignmentRules: [],
      passed: true,
    };
  }

  const branchCoverage = buildBranchAssignmentCoverage(context);
  const branchMissingAssignments = branchCoverage.flatMap((branch) =>
    branch.missingVariables.map((variable) => `${branch.branchId}:${variable}`),
  );

  const branchDuplicateAssignments = branchCoverage.flatMap((branch) =>
    branch.duplicateAssignments.map((item) => `${branch.branchId}:${item}`),
  );

  const branchViolatedRules = branchCoverage.flatMap((branch) =>
    branch.violatedRules.map((rule) => `${branch.branchId}:${rule}`),
  );

  const scenarioAssignmentsRequired = requiresScenarioAssignments(context);

  const missingAssignments = dedupe([
    ...context.unresolvedFromMapper.missingVariables,
    ...detectDraftMissingVariables(context),
    ...(scenarioAssignmentsRequired ? branchMissingAssignments : []),
  ]);

  const duplicateAssignments = dedupe([
    ...context.unresolvedFromMapper.duplicateAssignments,
    ...detectFormalDuplicateAssignments(context),
    ...detectExtractedDuplicateAssignments(context.globalAssignmentEvidence.assignments, context),
    ...detectDraftDuplicateSignals(context),
    ...branchDuplicateAssignments,
  ]);

  const unusedDomains = dedupe([
    ...context.unresolvedFromMapper.unusedDomains,
    ...detectUnusedDomainsFromAssignments(context),
  ]);

  const violatedAssignmentRules = dedupe([
    ...context.unresolvedFromMapper.violatedAssignmentRules,
    ...detectCompletenessRuleViolations(context, missingAssignments),
    ...detectExclusivityRuleViolations(context, duplicateAssignments),
    ...detectDomainUsageRuleViolations(context, unusedDomains),
    ...detectScenarioAssignmentRuleViolations(context, branchCoverage),
    ...detectPromiseWithoutAssignmentExecution(context, branchCoverage),
    ...branchViolatedRules,
  ]);

  const result: DiagnosticAssignmentConsistencyResult = {
    allVariablesAssigned: missingAssignments.length === 0,
    duplicateAssignments,
    missingAssignments,
    violatedAssignmentRules,
    passed:
      missingAssignments.length === 0 &&
      duplicateAssignments.length === 0 &&
      violatedAssignmentRules.length === 0,
    extractedAssignments: context.globalAssignmentEvidence.assignments,
    branchAssignmentCoverage: branchCoverage,
    unassignedByBranch: Object.fromEntries(
      branchCoverage.map((branch) => [branch.branchId, branch.missingVariables]),
    ),
    assignmentEvidence: context.globalAssignmentEvidence.evidence,
    unusedDomains,
  };

  return result;
}

function buildAssignmentContext(input: AssignmentCheckInput): AssignmentContext {
  const domainMapping = input.domainMapping;
  const draftAnswer = String(input.draftAnswer ?? "");
  const explicitConstraints = safeStringArray(input.explicitConstraints);
  const scenarioBranches = Array.isArray(input.scenarioBranches)
    ? input.scenarioBranches.filter(isValidScenarioBranch)
    : [];

  const variables = safeStringArray(domainMapping?.variables);
  const domains = safeStringArray(domainMapping?.domains);
  const assignmentRules = safeStringArray(domainMapping?.assignmentRules);
  const formalAssignments = normalizeAssignments(domainMapping?.assignments);
  const globalAssignmentEvidence = extractAssignmentsFromText({
    text: draftAnswer,
    variables,
    domains,
    formalAssignments,
  });

  return {
    domainMapping,
    draftAnswer,
    normalizedDraft: normalize(draftAnswer),
    explicitConstraints,
    normalizedConstraints: normalize(explicitConstraints.join(" ")),
    scenarioBranches,
    variables,
    domains,
    assignmentRules,
    formalAssignments,
    unresolvedFromMapper: safeDetectUnresolvedAssignments(domainMapping, draftAnswer),
    globalAssignmentEvidence,
  };
}

function safeDetectUnresolvedAssignments(
  domainMapping: DomainMapping | undefined,
  draftAnswer: string,
): DetectorResult {
  try {
    const result = detectUnresolvedAssignments(domainMapping, draftAnswer) as unknown;
    const record = asRecord(result);

    return {
      missingVariables: readStringArray(record, "missingVariables"),
      unusedDomains: readStringArray(record, "unusedDomains"),
      duplicateAssignments: readStringArray(record, "duplicateAssignments"),
      violatedAssignmentRules: readStringArray(record, "violatedAssignmentRules"),
    };
  } catch {
    return {
      missingVariables: [],
      unusedDomains: [],
      duplicateAssignments: [],
      violatedAssignmentRules: [],
    };
  }
}

function buildBranchAssignmentCoverage(
  context: AssignmentContext,
): BranchAssignmentCoverage[] {
  if (context.scenarioBranches.length === 0 || context.variables.length === 0) {
    return [];
  }

  return context.scenarioBranches.map((branch, index) => {
    const branchId = scenarioBranchId(branch, index);
    const window = buildScenarioWindow(context, branch);
    const localAssignments = extractAssignmentsFromText({
      text: window,
      variables: context.variables,
      domains: context.domains,
      formalAssignments: {},
    });

    const assignedVariables = Object.keys(localAssignments.assignments);
    const missingVariables = context.variables
      .map((variable) => normalize(variable))
      .filter((variable) => !assignedVariables.includes(variable));

    const duplicateAssignments = detectExtractedDuplicateAssignments(
      localAssignments.assignments,
      context,
    );

    const violatedRules = dedupe([
      ...(missingVariables.length > 0 ? ["branch_assignment_incomplete"] : []),
      ...(duplicateAssignments.length > 0 && requiresExclusivity(context)
        ? ["branch_exclusive_assignment_failed"]
        : []),
      ...(window ? [] : ["scenario_window_not_found"]),
    ]);

    return {
      branchId,
      assignedVariables,
      missingVariables,
      duplicateAssignments,
      violatedRules,
      evidence: flattenEvidence(localAssignments.evidence),
      passed:
        missingVariables.length === 0 &&
        duplicateAssignments.length === 0 &&
        violatedRules.length === 0,
    };
  });
}

function buildScenarioWindow(
  context: AssignmentContext,
  branch: ScenarioBranch,
): string {
  const branchSignals = dedupe([
    ...extractScenarioDiscriminators(branch),
    ...extractUsefulTokens(scenarioBranchText(branch)),
  ]);

  if (branchSignals.length === 0) {
    return context.scenarioBranches.length === 1 ? context.draftAnswer : "";
  }

  const sentences = splitSentences(context.draftAnswer);
  const selected = new Set<number>();

  for (let index = 0; index < sentences.length; index += 1) {
    const sentence = normalize(sentences[index]);

    if (!sentence) {
      continue;
    }

    const matched = branchSignals.some((signal) =>
      hasMeaningfulReference(signal, sentence, 0.5),
    );

    if (matched) {
      selected.add(index);
      selected.add(index + 1);
      selected.add(index + 2);
    }
  }

  if (selected.size === 0) {
    return "";
  }

  return Array.from(selected)
    .filter((index) => index >= 0 && index < sentences.length)
    .sort((left, right) => left - right)
    .map((index) => sentences[index])
    .join(" ");
}

function extractAssignmentsFromText(input: {
  text: string;
  variables: readonly string[];
  domains: readonly string[];
  formalAssignments: Record<string, string>;
}): AssignmentEvidenceResult {
  const assignments: Record<string, string> = {};
  const evidence: Record<string, string[]> = {};

  for (const [variable, domain] of Object.entries(input.formalAssignments)) {
    const normalizedVariable = normalize(variable);
    const normalizedDomain = normalize(domain);

    if (!normalizedVariable || !normalizedDomain) {
      continue;
    }

    assignments[normalizedVariable] = normalizedDomain;
    pushEvidence(evidence, normalizedVariable, `formal:${variable}->${domain}`);
  }

  const segments = splitAssignmentSegments(input.text);

  for (const segment of segments) {
    const normalizedSegment = normalize(segment);

    if (!normalizedSegment || hasLocalNegation(normalizedSegment)) {
      continue;
    }

    for (const variable of input.variables) {
      const normalizedVariable = normalize(variable);

      if (!normalizedVariable || !hasMeaningfulReference(variable, normalizedSegment, 0.5)) {
        continue;
      }

      const matchedDomain = bestDomainMatch({
        segment: normalizedSegment,
        variable,
        domains: input.domains,
      });

      if (!matchedDomain) {
        continue;
      }

      if (!hasAssignmentRelation(normalizedSegment, variable, matchedDomain)) {
        continue;
      }

      assignments[normalizedVariable] = normalize(matchedDomain);
      pushEvidence(
        evidence,
        normalizedVariable,
        `draft:${variable}->${matchedDomain}`,
      );
    }
  }

  return {
    assignments,
    evidence,
  };
}

function bestDomainMatch(input: {
  segment: string;
  variable: string;
  domains: readonly string[];
}): string | null {
  const candidates = input.domains
    .filter((domain) => normalize(domain) !== normalize(input.variable))
    .filter((domain) => hasMeaningfulReference(domain, input.segment, 0.5))
    .map((domain) => ({
      domain,
      score: domainMatchScore(input.segment, input.variable, domain),
    }))
    .sort((left, right) => right.score - left.score);

  return candidates[0]?.domain ?? null;
}

function domainMatchScore(segment: string, variable: string, domain: string): number {
  const normalizedSegment = normalize(segment);
  const variableIndex = normalizedSegment.indexOf(normalize(variable));
  const domainIndex = normalizedSegment.indexOf(normalize(domain));

  let score = 0.5;

  if (variableIndex >= 0 && domainIndex >= 0) {
    const distance = Math.abs(variableIndex - domainIndex);

    if (distance <= 24) score += 0.32;
    else if (distance <= 64) score += 0.22;
    else if (distance <= 120) score += 0.12;
  }

  if (containsAny(normalizedSegment, ASSIGNMENT_RELATION_MARKERS)) {
    score += 0.2;
  }

  return score;
}

function hasAssignmentRelation(
  segment: string,
  variable: string,
  domain: string,
): boolean {
  const normalizedSegment = normalize(segment);
  const normalizedVariable = normalize(variable);
  const normalizedDomain = normalize(domain);

  if (!normalizedVariable || !normalizedDomain) {
    return false;
  }

  if (
    new RegExp(
      `${escapeRegExp(normalizedVariable)}\\s*(?:->|=>|=|:)\\s*${escapeRegExp(normalizedDomain)}`,
    ).test(normalizedSegment)
  ) {
    return true;
  }

  if (
    new RegExp(
      `${escapeRegExp(normalizedDomain)}\\s*(?:->|=>|=|:)\\s*${escapeRegExp(normalizedVariable)}`,
    ).test(normalizedSegment)
  ) {
    return true;
  }

  if (!containsAny(normalizedSegment, ASSIGNMENT_RELATION_MARKERS)) {
    return false;
  }

  const variableIndex = normalizedSegment.indexOf(normalizedVariable);
  const domainIndex = normalizedSegment.indexOf(normalizedDomain);

  if (variableIndex < 0 || domainIndex < 0) {
    return hasMeaningfulReference(variable, normalizedSegment, 0.5) &&
      hasMeaningfulReference(domain, normalizedSegment, 0.5);
  }

  return Math.abs(variableIndex - domainIndex) <= 180;
}

function detectDraftMissingVariables(context: AssignmentContext): string[] {
  if (context.variables.length === 0) {
    return [];
  }

  const completeAssignmentRequired =
    requiresCompleteAssignment(context) ||
    Object.keys(context.formalAssignments).length > 0;

  if (!completeAssignmentRequired || requiresScenarioAssignments(context)) {
    return [];
  }

  return context.variables
    .map((variable) => normalize(variable))
    .filter((variable) => !context.globalAssignmentEvidence.assignments[variable]);
}

function detectFormalDuplicateAssignments(context: AssignmentContext): string[] {
  return detectDuplicateValues(Object.values(context.formalAssignments), context);
}

function detectExtractedDuplicateAssignments(
  assignments: Record<string, string>,
  context: AssignmentContext,
): string[] {
  return detectDuplicateValues(Object.values(assignments), context);
}

function detectDuplicateValues(
  values: readonly string[],
  context: AssignmentContext,
): string[] {
  if (!requiresExclusivity(context)) {
    return [];
  }

  const normalizedValues = values.map((value) => normalize(value)).filter(Boolean);

  if (normalizedValues.length === 0) {
    return [];
  }

  const counts = new Map<string, number>();

  for (const value of normalizedValues) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([value]) => `duplicate_value:${value}`);
}

function detectDraftDuplicateSignals(context: AssignmentContext): string[] {
  if (!requiresExclusivity(context)) {
    return [];
  }

  if (
    /\b(mesmo valor|mesma opcao|mesma opção|valor repetido|opcao repetida|opção repetida|duplicate value|same value|same option|repeated value)\b/.test(
      context.normalizedDraft,
    ) &&
    !hasLocalNegation(context.normalizedDraft)
  ) {
    return ["draft_mentions_duplicate_assignment"];
  }

  return [];
}

function detectUnusedDomainsFromAssignments(context: AssignmentContext): string[] {
  if (context.domains.length === 0 || !requiresAllDomainsUsed(context)) {
    return [];
  }

  const assignedValues = new Set(
    Object.values(context.globalAssignmentEvidence.assignments)
      .map((value) => normalize(value))
      .filter(Boolean),
  );

  return context.domains
    .map((domain) => normalize(domain))
    .filter((domain) => !assignedValues.has(domain));
}

function detectCompletenessRuleViolations(
  context: AssignmentContext,
  missingAssignments: readonly string[],
): string[] {
  if (missingAssignments.length === 0) {
    return [];
  }

  if (requiresCompleteAssignment(context)) {
    return ["complete_assignment_required"];
  }

  if (context.scenarioBranches.length > 0) {
    return ["scenario_assignments_incomplete"];
  }

  return [];
}

function detectExclusivityRuleViolations(
  context: AssignmentContext,
  duplicateAssignments: readonly string[],
): string[] {
  if (duplicateAssignments.length === 0) {
    return [];
  }

  return requiresExclusivity(context) ? ["exclusive_assignment"] : [];
}

function detectDomainUsageRuleViolations(
  context: AssignmentContext,
  unusedDomains: readonly string[],
): string[] {
  if (unusedDomains.length === 0) {
    return [];
  }

  return requiresAllDomainsUsed(context)
    ? unusedDomains.map((domain) => `domain_not_assigned:${domain}`)
    : [];
}

function detectScenarioAssignmentRuleViolations(
  context: AssignmentContext,
  branchCoverage: readonly BranchAssignmentCoverage[],
): string[] {
  if (!requiresScenarioAssignments(context)) {
    return [];
  }

  return branchCoverage
    .filter((branch) => !branch.passed)
    .map((branch) => `scenario_branch_not_fully_assigned:${branch.branchId}`);
}

function detectPromiseWithoutAssignmentExecution(
  context: AssignmentContext,
  branchCoverage: readonly BranchAssignmentCoverage[],
): string[] {
  const hasPromise = containsAny(
    context.normalizedDraft,
    PROMISE_WITHOUT_ASSIGNMENT_MARKERS,
  );

  if (!hasPromise) {
    return [];
  }

  const hasEnoughGlobalAssignments =
    Object.keys(context.globalAssignmentEvidence.assignments).length >=
    context.variables.length;

  const branchModeIncomplete =
    branchCoverage.length > 0 && branchCoverage.some((branch) => !branch.passed);

  if (!hasEnoughGlobalAssignments || branchModeIncomplete) {
    return ["assignment_promised_but_not_executed"];
  }

  return [];
}

function requiresScenarioAssignments(context: AssignmentContext): boolean {
  return (
    context.scenarioBranches.length > 0 &&
    context.variables.length > 0 &&
    (
      context.scenarioBranches.length > 1 ||
      requiresCompleteAssignment(context) ||
      context.domains.length > 0
    )
  );
}

function requiresCompleteAssignment(context: AssignmentContext): boolean {
  const rules = normalize(context.assignmentRules.join(" "));
  const constraints = context.normalizedConstraints;

  return (
    containsAny(rules, COMPLETE_ASSIGNMENT_MARKERS) ||
    containsAny(constraints, COMPLETE_ASSIGNMENT_MARKERS) ||
    isLikelyOneToOneMapping(context)
  );
}

function requiresExclusivity(context: AssignmentContext): boolean {
  const rules = normalize(context.assignmentRules.join(" "));
  const constraints = context.normalizedConstraints;

  return (
    containsAny(rules, EXCLUSIVITY_MARKERS) ||
    containsAny(constraints, EXCLUSIVITY_MARKERS) ||
    isLikelyOneToOneMapping(context)
  );
}

function requiresAllDomainsUsed(context: AssignmentContext): boolean {
  const rules = normalize(context.assignmentRules.join(" "));
  const constraints = context.normalizedConstraints;

  return (
    containsAny(rules, DOMAIN_USAGE_MARKERS) ||
    containsAny(constraints, DOMAIN_USAGE_MARKERS) ||
    isLikelyOneToOneMapping(context)
  );
}

function isLikelyOneToOneMapping(context: AssignmentContext): boolean {
  return (
    context.variables.length > 1 &&
    context.domains.length > 1 &&
    context.variables.length === context.domains.length
  );
}

function extractScenarioDiscriminators(branch: ScenarioBranch): string[] {
  return dedupe([
    ...extractUsefulTokens(scenarioBranchText(branch)),
    ...extractColonTailTerms(scenarioBranchText(branch)),
  ]);
}

function scenarioBranchText(branch: ScenarioBranch): string {
  const record = branch as unknown as Record<string, unknown>;

  return dedupe([
    getString(record, "condition"),
    getString(record, "id"),
    ...getStringArray(record, "expectedCoverageSignals"),
  ]).join(" ");
}

function scenarioBranchId(branch: ScenarioBranch, index = 0): string {
  const record = branch as unknown as Record<string, unknown>;

  return (
    getString(record, "id") ||
    getString(record, "condition") ||
    `scenario_${index + 1}`
  );
}

function isValidScenarioBranch(branch: ScenarioBranch): boolean {
  return Boolean(
    String(branch.id ?? "").trim() ||
      String(branch.condition ?? "").trim() ||
      safeStringArray(branch.expectedCoverageSignals).length > 0,
  );
}

function extractColonTailTerms(value: string): string[] {
  const normalized = normalize(value);

  if (!normalized.includes(":")) {
    return [];
  }

  const tail = normalized.split(":").slice(1).join(":");

  return extractUsefulTokens(tail);
}

function extractUsefulTokens(value: string): string[] {
  return tokenize(value)
    .filter((token) => !STOPWORDS.has(token))
    .filter((token) => !GENERIC_SIGNAL_TOKENS.has(token))
    .filter((token) => !GENERIC_BRANCH_ID_PATTERN.test(token));
}

function splitSentences(text: string): string[] {
  return String(text ?? "")
    .split(/[.!?;\n]+/g)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function splitAssignmentSegments(text: string): string[] {
  return String(text ?? "")
    .split(/[.!?;\n]+/g)
    .flatMap((segment) => segment.split(/\s{2,}/g))
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function flattenEvidence(evidence: Record<string, string[]>): string[] {
  return dedupe(Object.values(evidence).flat());
}

function pushEvidence(
  evidence: Record<string, string[]>,
  key: string,
  value: string,
): void {
  evidence[key] = dedupe([...(evidence[key] ?? []), value]);
}

function normalizeAssignments(
  assignments: DomainMapping["assignments"] | undefined,
): Record<string, string> {
  if (!assignments || typeof assignments !== "object") {
    return {};
  }

  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(assignments)) {
    const cleanedKey = normalize(key);
    const cleanedValue = normalize(String(value ?? ""));

    if (!cleanedKey || !cleanedValue) {
      continue;
    }

    normalized[cleanedKey] = cleanedValue;
  }

  return normalized;
}

function getString(source: Record<string, unknown>, key: string): string {
  const value = source[key];

  return typeof value === "string" ? value : "";
}

function getStringArray(source: Record<string, unknown>, key: string): string[] {
  const value = source[key];

  return Array.isArray(value) ? safeStringArray(value) : [];
}

function readStringArray(source: Record<string, unknown>, key: string): string[] {
  const value = source[key];

  return Array.isArray(value) ? safeStringArray(value) : [];
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

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function containsAny(text: string, markers: readonly string[]): boolean {
  const normalized = normalize(text);

  return markers.some((marker) => {
    const normalizedMarker = normalize(marker);

    if (!normalizedMarker) {
      return false;
    }

    if (normalizedMarker.includes(" ")) {
      return normalized.includes(normalizedMarker);
    }

    return new RegExp(`\\b${escapeRegExp(normalizedMarker)}\\b`).test(
      normalized,
    );
  });
}

function hasLocalNegation(text: string): boolean {
  return containsAny(text, NEGATION_MARKERS);
}

function hasMeaningfulReference(
  value: string,
  normalizedReference: string,
  minOverlap = 0.5,
): boolean {
  const normalizedValue = normalize(value);
  const normalizedText = normalize(normalizedReference);

  if (!normalizedValue || !normalizedText) {
    return false;
  }

  if (normalizedText.includes(normalizedValue)) {
    return true;
  }

  const valueTokens = tokenize(normalizedValue);
  const referenceTokens = new Set(tokenize(normalizedText));

  if (valueTokens.length === 0 || referenceTokens.size === 0) {
    return false;
  }

  const overlap = valueTokens.filter((token) => referenceTokens.has(token)).length;

  return overlap / Math.max(1, valueTokens.length) >= minOverlap;
}

function tokenize(value: string): string[] {
  return normalize(value)
    .split(/\s+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
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

function normalize(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—]/g, "->")
    .replace(/[^a-z0-9\s_.:\-=|>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}