/**
 * Layer: 14-reasoning-and-generation-layer/problem-resolution-core
 * Module: scenario-enumerator
 * Responsibility: Enumerate conditional/alternative scenarios when the task demands branching.
 */

import type {
  ProblemRepresentation,
  ReasoningScenario,
  ScenarioBranch,
} from "./problem-resolution-types";

interface ScenarioCandidate {
  readonly id?: string;
  readonly description: string;
  readonly assumptions: string[];
  readonly applicableConstraints: string[];
  readonly valid: boolean | null;
  readonly source:
    | "formal_branch"
    | "conditional_clause"
    | "alternative_clause"
    | "domain_value"
    | "logical_requirement";
}

const CONDITIONAL_MARKERS = [
  "se",
  "caso",
  "quando",
  "supondo",
  "hipotese",
  "hipótese",
  "possibilidade",
  "cenario",
  "cenário",
  "ramo",
  "if",
  "case",
  "when",
  "assuming",
  "hypothesis",
  "possibility",
  "scenario",
  "branch",
];

const ALTERNATIVE_MARKERS = [
  "ou",
  "ou entao",
  "ou então",
  "alternativa",
  "possibilidade",
  "opcao",
  "opção",
  "or",
  "either",
  "alternative",
  "possibility",
  "option",
];

const BRANCHING_KIND_MARKERS = [
  "case_analysis",
  "single_action_inference",
  "observation_limited_reasoning",
  "deductive_elimination",
  "mapping_problem",
  "constraint_satisfaction",
];

const ELIMINATION_MARKERS = [
  "eliminacao",
  "eliminação",
  "eliminar",
  "descartar",
  "excluir",
  "resta",
  "sobra",
  "by elimination",
  "elimination",
  "eliminate",
  "exclude",
  "ruled out",
  "remaining",
];

const GENERIC_NOISE_TOKENS = new Set([
  "se",
  "caso",
  "quando",
  "supondo",
  "hipotese",
  "possibilidade",
  "cenario",
  "ramo",
  "if",
  "case",
  "when",
  "assuming",
  "hypothesis",
  "possibility",
  "scenario",
  "branch",
  "value",
  "domain",
  "entity",
  "item",
  "option",
  "result",
  "valor",
  "dominio",
  "entidade",
  "opcao",
  "resultado",
]);

export function enumerateReasoningScenarios(
  representation: ProblemRepresentation,
): ReasoningScenario[] {
  const formalCandidates = candidatesFromFormalBranches(representation);

  if (formalCandidates.length > 0) {
    return finalizeScenarios(formalCandidates);
  }

  const sourceText = buildScenarioSourceText(representation);

  const candidates = dedupeCandidates([
    ...candidatesFromConditionalClauses(representation, sourceText),
    ...candidatesFromAlternativeClauses(representation, sourceText),
    ...candidatesFromDomainValues(representation),
    ...candidatesFromLogicalRequirement(representation, sourceText),
  ]);

  return finalizeScenarios(candidates).slice(0, 16);
}

function candidatesFromFormalBranches(
  representation: ProblemRepresentation,
): ScenarioCandidate[] {
  const branches = Array.isArray(representation.scenarioBranches)
    ? representation.scenarioBranches
    : [];

  return branches
    .filter(isValidScenarioBranch)
    .map((branch, index) => ({
      id: branch.id || `scenario_${index + 1}`,
      description: buildFormalBranchDescription(branch),
      assumptions: buildScenarioAssumptions(representation, index, [
        `branch:${index + 1}`,
        `source:formal_branch`,
        ...safeStringArray(branch.expectedCoverageSignals)
          .slice(0, 4)
          .map((signal) => `signal:${signal}`),
      ]),
      applicableConstraints: buildApplicableConstraints(representation),
      valid: branch.resolved ?? null,
      source: "formal_branch",
    }));
}

function candidatesFromConditionalClauses(
  representation: ProblemRepresentation,
  sourceText: string,
): ScenarioCandidate[] {
  const clauses = extractConditionalClauses(sourceText);

  return clauses.map((clause, index) => ({
    id: `conditional_scenario_${index + 1}`,
    description: deriveScenarioDescription(clause),
    assumptions: buildScenarioAssumptions(representation, index, [
      `branch:${index + 1}`,
      "source:conditional_clause",
    ]),
    applicableConstraints: buildApplicableConstraints(representation),
    valid: null,
    source: "conditional_clause",
  }));
}

function candidatesFromAlternativeClauses(
  representation: ProblemRepresentation,
  sourceText: string,
): ScenarioCandidate[] {
  const alternatives = extractAlternativeClauses(sourceText);

  return alternatives.map((alternative, index) => ({
    id: `alternative_scenario_${index + 1}`,
    description: deriveScenarioDescription(alternative),
    assumptions: buildScenarioAssumptions(representation, index, [
      `branch:${index + 1}`,
      "source:alternative_clause",
    ]),
    applicableConstraints: buildApplicableConstraints(representation),
    valid: null,
    source: "alternative_clause",
  }));
}

function candidatesFromDomainValues(
  representation: ProblemRepresentation,
): ScenarioCandidate[] {
  const domains = safeStringArray(representation.domainMapping?.domains);

  const shouldInfer =
    domains.length >= 2 &&
    domains.length <= 12 &&
    Boolean(
      representation.actionBudget ||
        (representation.observationLimits ?? []).length > 0 ||
        containsAny(
          normalize(
            [
              representation.logicalProblemKind ?? "",
              representation.taskType,
              ...(representation.completionObligations ?? []),
              ...(representation.closureRequirements ?? []),
              ...(representation.invariants ?? []),
            ].join(" "),
          ),
          BRANCHING_KIND_MARKERS,
        ),
    );

  if (!shouldInfer) {
    return [];
  }

  return domains.map((domain, index) => ({
    id: `domain_scenario_${index + 1}`,
    description: `possible_result_is:${domain}`,
    assumptions: buildScenarioAssumptions(representation, index, [
      `branch:${index + 1}`,
      "source:domain_value",
      `possible_result:${domain}`,
    ]),
    applicableConstraints: buildApplicableConstraints(representation),
    valid: null,
    source: "domain_value",
  }));
}

function candidatesFromLogicalRequirement(
  representation: ProblemRepresentation,
  sourceText: string,
): ScenarioCandidate[] {
  const searchable = normalize(
    [
      sourceText,
      representation.logicalProblemKind ?? "",
      representation.taskType,
      ...(representation.completionObligations ?? []),
      ...(representation.closureRequirements ?? []),
      ...(representation.invariants ?? []),
    ].join(" "),
  );

  const needsBranching =
    containsAny(searchable, ELIMINATION_MARKERS) ||
    containsAny(searchable, ["case_analysis", "cover_all_scenario_branches"]);

  if (!needsBranching) {
    return [];
  }

  const hasExplicitScenario =
    containsAny(searchable, CONDITIONAL_MARKERS) ||
    containsAny(searchable, ALTERNATIVE_MARKERS);

  if (hasExplicitScenario) {
    return [];
  }

  return [
    {
      id: "required_branching_scenario",
      description:
        "A branch analysis is required, but explicit branches were not fully extracted from the prompt.",
      assumptions: buildScenarioAssumptions(representation, 0, [
        "source:logical_requirement",
        "branching_required",
      ]),
      applicableConstraints: buildApplicableConstraints(representation),
      valid: null,
      source: "logical_requirement",
    },
  ];
}

function extractConditionalClauses(input: string): string[] {
  const sentences = splitSentences(input);
  const clauses: string[] = [];

  for (const sentence of sentences) {
    const normalizedSentence = normalize(sentence);

    if (!containsAny(normalizedSentence, CONDITIONAL_MARKERS)) {
      continue;
    }

    const slices = sentence
      .split(
        /(?=\bse\b|\bcaso\b|\bquando\b|\bsupondo\b|\bif\b|\bcase\b|\bwhen\b|\bassuming\b)/gi,
      )
      .map(cleanText)
      .filter((slice) => containsAny(slice, CONDITIONAL_MARKERS));

    if (slices.length > 0) {
      clauses.push(...slices);
      continue;
    }

    clauses.push(sentence);
  }

  return dedupe(clauses).slice(0, 16);
}

function extractAlternativeClauses(input: string): string[] {
  const sentences = splitSentences(input);
  const alternatives: string[] = [];

  for (const sentence of sentences) {
    const normalizedSentence = normalize(sentence);

    if (!containsAny(normalizedSentence, ALTERNATIVE_MARKERS)) {
      continue;
    }

    const parts = sentence
      .split(/\b(?:ou|or)\b/gi)
      .map(cleanText)
      .filter((part) => tokenCount(part) >= 2);

    if (parts.length >= 2 && parts.length <= 8) {
      alternatives.push(...parts);
      continue;
    }

    alternatives.push(sentence);
  }

  return dedupe(alternatives).slice(0, 16);
}

function buildScenarioSourceText(representation: ProblemRepresentation): string {
  return [
    representation.userGoal,
    representation.taskType,
    representation.logicalProblemKind ?? "",
    ...safeStringArray(representation.explicitConstraints),
    ...safeStringArray(representation.implicitConstraints),
    ...safeStringArray(representation.invariants),
    ...safeStringArray(representation.completionObligations),
    ...safeStringArray(representation.closureRequirements),
    ...safeStringArray(representation.assumptions),
  ]
    .map(cleanText)
    .filter(Boolean)
    .join(" ");
}

function buildFormalBranchDescription(branch: ScenarioBranch): string {
  return cleanText(
    [
      branch.condition,
      ...safeStringArray(branch.expectedCoverageSignals).slice(0, 6),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function deriveScenarioDescription(clause: string): string {
  const cleaned = cleanText(clause)
    .replace(
      /^(se|if|caso|quando|when|assuming|supondo|cenario|cenário|scenario|case)\b[:\s,;-]*/i,
      "",
    )
    .replace(/\b(entao|então|then)\b[:\s,;-]*/gi, "")
    .trim();

  return cleaned || cleanText(clause);
}

function buildScenarioAssumptions(
  representation: ProblemRepresentation,
  index: number,
  extras: readonly string[],
): string[] {
  return dedupe([
    ...safeStringArray(representation.assumptions).slice(0, 4),
    `scenario_index:${index + 1}`,
    ...extras,
  ]);
}

function buildApplicableConstraints(
  representation: ProblemRepresentation,
): string[] {
  return dedupe([
    ...safeStringArray(representation.explicitConstraints),
    ...safeStringArray(representation.implicitConstraints),
    ...(representation.actionBudget ? ["respect_action_budget"] : []),
    ...((representation.observationLimits ?? []).length > 0
      ? ["respect_observation_limits"]
      : []),
    ...(representation.domainMapping ? ["respect_assignment_rules"] : []),
  ]).slice(0, 12);
}

function finalizeScenarios(
  candidates: readonly ScenarioCandidate[],
): ReasoningScenario[] {
  return dedupeCandidates(candidates).map((candidate, index) => ({
    id: candidate.id || `scenario_${index + 1}`,
    description: candidate.description,
    assumptions: dedupe(candidate.assumptions),
    applicableConstraints: dedupe(candidate.applicableConstraints),
    valid: candidate.valid,
  }));
}

function dedupeCandidates(
  candidates: readonly ScenarioCandidate[],
): ScenarioCandidate[] {
  const byKey = new Map<string, ScenarioCandidate>();

  for (const candidate of candidates) {
    const description = cleanText(candidate.description);

    if (!description) {
      continue;
    }

    const key = normalize(
      removeGenericTokens(description)
        .split(/\s+/g)
        .slice(0, 16)
        .join(" "),
    );

    if (!key) {
      continue;
    }

    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, {
        ...candidate,
        description,
      });
      continue;
    }

    byKey.set(key, {
      ...existing,
      assumptions: dedupe([
        ...existing.assumptions,
        ...candidate.assumptions,
      ]),
      applicableConstraints: dedupe([
        ...existing.applicableConstraints,
        ...candidate.applicableConstraints,
      ]),
      valid:
        existing.valid === null || existing.valid === undefined
          ? candidate.valid
          : existing.valid,
    });
  }

  return Array.from(byKey.values());
}

function isValidScenarioBranch(branch: ScenarioBranch): boolean {
  return Boolean(
    cleanText(branch.id) ||
      cleanText(branch.condition) ||
      safeStringArray(branch.expectedCoverageSignals).length > 0,
  );
}

function splitSentences(text: string): string[] {
  return String(text ?? "")
    .split(/[.!?;\n]+/g)
    .map(cleanText)
    .filter(Boolean);
}

function tokenCount(text: string): number {
  return tokenize(text).length;
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(/\s+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
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

function removeGenericTokens(text: string): string {
  return tokenize(text)
    .filter((token) => !GENERIC_NOISE_TOKENS.has(token))
    .join(" ");
}

function safeStringArray(values: readonly unknown[] | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return dedupe(
    values
      .map((value) => cleanText(String(value ?? "")))
      .filter(Boolean),
  );
}

function dedupe(values: ReadonlyArray<string>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const cleaned = cleanText(value);
    const key = normalize(cleaned);

    if (!cleaned || !key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

function cleanText(text: string | undefined): string {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_\s:.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}