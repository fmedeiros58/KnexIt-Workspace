/**
 * Layer: 14-reasoning-and-generation-layer/problem-resolution-core
 * Module: scenario-coverage-validator
 * Responsibility: Validate whether required scenario branches are covered and resolved by the draft.
 */

import type {
  ScenarioBranch,
  ScenarioCoverageResult,
} from "./problem-resolution-types";

type BranchCoverageLevel = "missing" | "mentioned" | "resolved";

interface BranchCoverageEvidence {
  readonly branchKey: string;
  readonly coverageLevel: BranchCoverageLevel;
  readonly conditionCovered: boolean;
  readonly resolutionCovered: boolean;
  readonly evidenceSignals: string[];
  readonly missingResolutionSignals: string[];
}

interface ScenarioCoverageDiagnosticResult extends ScenarioCoverageResult {
  partiallyCoveredBranches?: string[];
  unresolvedBranches?: string[];
  branchEvidence?: Record<string, string[]>;
  branchFailures?: Record<string, string[]>;
  branchCoverageLevels?: Record<string, BranchCoverageLevel>;
}

interface BranchEvaluationInput {
  readonly branch: ScenarioBranch;
  readonly index: number;
  readonly branchCount: number;
  readonly normalizedDraft: string;
  readonly rawDraft: string;
}

interface LocalBranchWindow {
  readonly text: string;
  readonly evidence: string[];
}

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

const BRANCH_STRUCTURE_MARKERS = [
  "primeiro caso",
  "segundo caso",
  "terceiro caso",
  "caso 1",
  "caso 2",
  "caso 3",
  "cenario 1",
  "cenario 2",
  "cenario 3",
  "cenário 1",
  "cenário 2",
  "cenário 3",
  "possibilidade 1",
  "possibilidade 2",
  "possibilidade 3",
  "alternativa 1",
  "alternativa 2",
  "alternativa 3",
  "por um lado",
  "por outro lado",
  "de um lado",
  "de outro lado",
  "first case",
  "second case",
  "third case",
  "case 1",
  "case 2",
  "case 3",
  "scenario 1",
  "scenario 2",
  "scenario 3",
  "possibility 1",
  "possibility 2",
  "possibility 3",
  "alternative 1",
  "alternative 2",
  "alternative 3",
  "on one hand",
  "on the other hand",
];

const RESOLUTION_MARKERS = [
  "entao",
  "então",
  "logo",
  "portanto",
  "conclui",
  "concluimos",
  "concluímos",
  "decorre",
  "resulta",
  "fica",
  "resta",
  "sobra",
  "deve ser",
  "sera",
  "será",
  "corresponde",
  "recebe",
  "mapeia",
  "atribui",
  "associa",
  "contem",
  "contém",
  "is",
  "then",
  "therefore",
  "thus",
  "follows",
  "results",
  "must be",
  "will be",
  "maps to",
  "corresponds",
  "receives",
  "is assigned",
  "contains",
];

const STRONG_ASSIGNMENT_MARKERS = [
  "->",
  "=>",
  "=",
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
  "maps to",
  "assigned to",
  "corresponds to",
  "contains",
];

const ELIMINATION_MARKERS = [
  "por eliminacao",
  "por eliminação",
  "eliminacao",
  "eliminação",
  "eliminar",
  "elimina",
  "descartar",
  "excluir",
  "nao pode ser",
  "não pode ser",
  "impossivel",
  "impossível",
  "resta",
  "sobra",
  "by elimination",
  "elimination",
  "eliminate",
  "excluding",
  "exclude",
  "ruled out",
  "cannot be",
  "impossible",
  "remaining",
];

const PROMISE_WITHOUT_EXECUTION_MARKERS = [
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

const SUPPORT_MARKERS = [
  "porque",
  "pois",
  "uma vez que",
  "com base",
  "a partir",
  "decorre",
  "premissa",
  "restricao",
  "restrição",
  "regra",
  "because",
  "since",
  "based on",
  "from",
  "premise",
  "constraint",
  "rule",
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

export function validateScenarioCoverage(input: {
  scenarioBranches?: ScenarioBranch[];
  draftAnswer: string;
}): ScenarioCoverageResult {
  const branches = Array.isArray(input.scenarioBranches)
    ? input.scenarioBranches.filter(isValidBranch)
    : [];

  if (branches.length === 0) {
    return {
      requiredBranches: [],
      coveredBranches: [],
      missingBranches: [],
      passed: true,
    };
  }

  const normalizedDraft = normalize(input.draftAnswer);
  const requiredBranches = branches.map((branch, index) =>
    branchKey(branch, index),
  );

  const coverage = branches.map((branch, index) =>
    evaluateBranchCoverage({
      branch,
      index,
      branchCount: branches.length,
      normalizedDraft,
      rawDraft: input.draftAnswer,
    }),
  );

  const coveredBranches = coverage
    .filter((item) => item.coverageLevel === "resolved")
    .map((item) => item.branchKey);

  const partiallyCoveredBranches = coverage
    .filter((item) => item.coverageLevel === "mentioned")
    .map((item) => item.branchKey);

  const missingBranches = coverage
    .filter((item) => item.coverageLevel !== "resolved")
    .map((item) => item.branchKey);

  const branchEvidence = Object.fromEntries(
    coverage.map((item) => [item.branchKey, item.evidenceSignals]),
  );

  const branchFailures = Object.fromEntries(
    coverage
      .filter((item) => item.coverageLevel !== "resolved")
      .map((item) => [item.branchKey, item.missingResolutionSignals]),
  );

  const branchCoverageLevels = Object.fromEntries(
    coverage.map((item) => [item.branchKey, item.coverageLevel]),
  );

  const result: ScenarioCoverageDiagnosticResult = {
    requiredBranches,
    coveredBranches,
    missingBranches,
    partiallyCoveredBranches,
    unresolvedBranches: missingBranches,
    branchEvidence,
    branchFailures,
    branchCoverageLevels,
    passed: missingBranches.length === 0,
  };

  return result;
}

function evaluateBranchCoverage(
  input: BranchEvaluationInput,
): BranchCoverageEvidence {
  const key = branchKey(input.branch, input.index);
  const id = String(input.branch.id ?? "").trim();
  const condition = String(input.branch.condition ?? "").trim();
  const expectedSignals = safeStringArray(input.branch.expectedCoverageSignals);

  const normalizedId = normalize(id);
  const normalizedCondition = normalize(condition);
  const evidenceSignals: string[] = [];
  const missingResolutionSignals: string[] = [];

  if (
    normalizedId &&
    !isGenericBranchId(normalizedId) &&
    containsMarker(input.normalizedDraft, normalizedId)
  ) {
    evidenceSignals.push(`id:${id}`);
  }

  if (
    normalizedCondition &&
    normalizedCondition.length >= 8 &&
    input.normalizedDraft.includes(normalizedCondition)
  ) {
    evidenceSignals.push(`condition_exact:${condition}`);
  }

  const discriminators = extractBranchDiscriminators(input.branch);
  const matchedDiscriminators = discriminators.filter((signal) =>
    hasMeaningfulReference(signal, input.normalizedDraft, 0.5),
  );

  if (
    discriminators.length > 0 &&
    matchedDiscriminators.length >= requiredMatchCount(discriminators.length)
  ) {
    evidenceSignals.push(
      `discriminators:${matchedDiscriminators.join(",")}`,
    );
  }

  const usefulExpectedSignals = expectedSignals.filter(isUsefulCoverageSignal);
  const matchedExpectedSignals = usefulExpectedSignals.filter((signal) =>
    hasMeaningfulReference(signal, input.normalizedDraft, 0.5),
  );

  if (
    usefulExpectedSignals.length > 0 &&
    matchedExpectedSignals.length >= requiredMatchCount(usefulExpectedSignals.length)
  ) {
    evidenceSignals.push(
      `expected_signals:${matchedExpectedSignals.join(",")}`,
    );
  }

  if (
    condition &&
    hasTokenOverlap(
      condition,
      input.normalizedDraft,
      conditionOverlapThreshold(condition),
    )
  ) {
    evidenceSignals.push(`condition_overlap:${condition}`);
  }

  const conditionCovered = evidenceSignals.length > 0;
  const localWindow = buildLocalBranchWindow({
    branch: input.branch,
    normalizedDraft: input.normalizedDraft,
    rawDraft: input.rawDraft,
    discriminators,
    expectedSignals: usefulExpectedSignals,
    condition,
    branchCount: input.branchCount,
  });

  evidenceSignals.push(...localWindow.evidence);

  const resolutionEvidence = detectLocalResolutionEvidence(localWindow.text);

  if (resolutionEvidence.length > 0) {
    evidenceSignals.push(...resolutionEvidence);
  }

  const resolutionCovered = resolutionEvidence.length > 0;

  if (!conditionCovered) {
    missingResolutionSignals.push("branch_condition_not_mentioned");
  }

  if (conditionCovered && !resolutionCovered) {
    missingResolutionSignals.push("branch_mentioned_without_local_resolution");
  }

  if (
    conditionCovered &&
    !resolutionCovered &&
    containsAny(localWindow.text || input.normalizedDraft, PROMISE_WITHOUT_EXECUTION_MARKERS)
  ) {
    missingResolutionSignals.push("branch_promised_but_not_resolved");
  }

  if (
    conditionCovered &&
    !resolutionCovered &&
    hasEliminationPromiseWithoutExecution(localWindow.text || input.normalizedDraft)
  ) {
    missingResolutionSignals.push("elimination_claim_without_executed_elimination");
  }

  const coverageLevel: BranchCoverageLevel = !conditionCovered
    ? "missing"
    : resolutionCovered
      ? "resolved"
      : "mentioned";

  return {
    branchKey: key,
    coverageLevel,
    conditionCovered,
    resolutionCovered,
    evidenceSignals: dedupe(evidenceSignals),
    missingResolutionSignals: dedupe(missingResolutionSignals),
  };
}

function buildLocalBranchWindow(input: {
  branch: ScenarioBranch;
  normalizedDraft: string;
  rawDraft: string;
  discriminators: readonly string[];
  expectedSignals: readonly string[];
  condition: string;
  branchCount: number;
}): LocalBranchWindow {
  const sentences = splitSentences(input.rawDraft);
  const matchedIndexes = new Set<number>();
  const evidence: string[] = [];

  const branchSignals = dedupe([
    ...input.discriminators,
    ...input.expectedSignals,
    ...extractUsefulTokens(input.condition),
    ...extractColonTailTerms(input.condition),
  ]).filter(isUsefulToken);

  for (let index = 0; index < sentences.length; index += 1) {
    const normalizedSentence = normalize(sentences[index]);

    if (!normalizedSentence) {
      continue;
    }

    const matchedSignal = branchSignals.find((signal) =>
      hasMeaningfulReference(signal, normalizedSentence, 0.5),
    );

    if (matchedSignal) {
      matchedIndexes.add(index);
      matchedIndexes.add(index + 1);
      matchedIndexes.add(index + 2);
      evidence.push(`local_window_signal:${matchedSignal}`);
      continue;
    }

    if (
      input.condition &&
      hasTokenOverlap(
        input.condition,
        normalizedSentence,
        conditionOverlapThreshold(input.condition),
      )
    ) {
      matchedIndexes.add(index);
      matchedIndexes.add(index + 1);
      evidence.push("local_window_condition_overlap");
    }
  }

  if (matchedIndexes.size === 0 && input.branchCount === 1) {
    return {
      text: input.normalizedDraft,
      evidence: ["local_window:single_branch_full_draft"],
    };
  }

  const localText = Array.from(matchedIndexes)
    .filter((index) => index >= 0 && index < sentences.length)
    .sort((left, right) => left - right)
    .map((index) => sentences[index])
    .join(" ");

  return {
    text: normalize(localText),
    evidence: dedupe(evidence),
  };
}

function detectLocalResolutionEvidence(localText: string): string[] {
  const evidence: string[] = [];
  const normalized = normalize(localText);

  if (!normalized) {
    return evidence;
  }

  if (hasStrongAssignmentResolution(normalized)) {
    evidence.push("local_resolution:assignment_or_mapping");
  }

  if (hasConsequenceResolution(normalized)) {
    evidence.push("local_resolution:consequence");
  }

  if (hasExecutedElimination(normalized)) {
    evidence.push("local_resolution:executed_elimination");
  }

  if (hasSupportedConclusion(normalized)) {
    evidence.push("local_resolution:supported_conclusion");
  }

  return dedupe(evidence);
}

function hasStrongAssignmentResolution(normalizedText: string): boolean {
  if (
    /\b[a-z0-9_.:-]{1,80}\s*(?:=|->|=>)\s*[a-z0-9_.:-]{1,120}\b/.test(
      normalizedText,
    )
  ) {
    return true;
  }

  if (!containsAny(normalizedText, STRONG_ASSIGNMENT_MARKERS)) {
    return false;
  }

  const usefulTokens = tokenize(normalizedText).filter(isUsefulToken);

  return usefulTokens.length >= 3;
}

function hasConsequenceResolution(normalizedText: string): boolean {
  const hasResolutionMarker = containsAny(normalizedText, RESOLUTION_MARKERS);
  const hasSupportOrAssignment =
    containsAny(normalizedText, SUPPORT_MARKERS) ||
    containsAny(normalizedText, STRONG_ASSIGNMENT_MARKERS) ||
    /\b(logo|portanto|therefore|thus|then)\b/.test(normalizedText);

  return hasResolutionMarker && hasSupportOrAssignment;
}

function hasExecutedElimination(normalizedText: string): boolean {
  const hasElimination = containsAny(normalizedText, ELIMINATION_MARKERS);

  if (!hasElimination) {
    return false;
  }

  const eliminatedSignals = countMarkers(normalizedText, [
    "nao pode ser",
    "não pode ser",
    "impossivel",
    "impossível",
    "elimina",
    "eliminar",
    "descarta",
    "exclui",
    "cannot be",
    "impossible",
    "eliminate",
    "ruled out",
    "exclude",
  ]);

  const remainingSignals = countMarkers(normalizedText, [
    "resta",
    "sobra",
    "logo",
    "portanto",
    "therefore",
    "thus",
    "remaining",
  ]);

  return eliminatedSignals > 0 && remainingSignals > 0;
}

function hasSupportedConclusion(normalizedText: string): boolean {
  const hasConclusion = containsAny(normalizedText, [
    "conclusao",
    "conclusão",
    "conclui",
    "resultado final",
    "resposta final",
    "final answer",
    "in conclusion",
  ]);

  if (!hasConclusion) {
    return false;
  }

  return containsAny(normalizedText, SUPPORT_MARKERS) ||
    containsAny(normalizedText, STRONG_ASSIGNMENT_MARKERS);
}

function hasEliminationPromiseWithoutExecution(normalizedText: string): boolean {
  const hasPromise = containsAny(normalizedText, PROMISE_WITHOUT_EXECUTION_MARKERS);

  if (!hasPromise) {
    return false;
  }

  return !hasExecutedElimination(normalizedText) &&
    !hasStrongAssignmentResolution(normalizedText);
}

function extractBranchDiscriminators(branch: ScenarioBranch): string[] {
  const condition = String(branch.condition ?? "");
  const id = String(branch.id ?? "");
  const expectedSignals = safeStringArray(branch.expectedCoverageSignals);

  const fromCondition = [
    ...extractColonTailTerms(condition),
    ...extractSymbolicTerms(condition),
    ...extractQuotedTerms(condition),
    ...extractUsefulTokens(condition),
  ];

  const fromExpectedSignals = expectedSignals.flatMap((signal) => [
    ...extractColonTailTerms(signal),
    ...extractSymbolicTerms(signal),
    ...extractQuotedTerms(signal),
    ...extractUsefulTokens(signal),
  ]);

  const fromId = isGenericBranchId(id) ? [] : extractUsefulTokens(id);

  return dedupe([
    ...fromCondition,
    ...fromExpectedSignals,
    ...fromId,
  ]).slice(0, 12);
}

function extractColonTailTerms(value: string): string[] {
  const normalized = normalize(value);

  if (!normalized.includes(":")) {
    return [];
  }

  const tail = normalized.split(":").slice(1).join(":");

  return extractUsefulTokens(tail);
}

function extractSymbolicTerms(value: string): string[] {
  return dedupe(
    String(value ?? "")
      .match(/\b[a-zA-Z]+_[a-zA-Z0-9_]+\b|\b[A-Z][A-Z0-9_]{0,16}\b|\b\w*\d+\w*\b/g) ??
      [],
  )
    .map((item) => normalize(item))
    .filter(isUsefulToken);
}

function extractQuotedTerms(value: string): string[] {
  const matches = String(value ?? "").matchAll(
    /["“”'‘’`]([^"“”'‘’`]{1,80})["“”'‘’`]/g,
  );

  return dedupe(
    Array.from(matches)
      .map((match) => normalize(match[1] ?? ""))
      .filter(Boolean),
  );
}

function extractUsefulTokens(value: string): string[] {
  return tokenize(value).filter(isUsefulToken);
}

function isUsefulCoverageSignal(signal: string): boolean {
  const normalized = normalize(signal);

  if (!normalized) {
    return false;
  }

  if (isGenericBranchId(normalized)) {
    return false;
  }

  const tokens = tokenize(normalized).filter(isUsefulToken);

  return tokens.length > 0;
}

function isUsefulToken(token: string): boolean {
  const normalized = normalize(token);

  if (!normalized) {
    return false;
  }

  if (STOPWORDS.has(normalized) || GENERIC_SIGNAL_TOKENS.has(normalized)) {
    return false;
  }

  return normalized.length >= 2;
}

function requiredMatchCount(totalSignals: number): number {
  if (totalSignals <= 1) return 1;
  if (totalSignals <= 3) return 1;
  return Math.ceil(totalSignals * 0.5);
}

function conditionOverlapThreshold(condition: string): number {
  const tokenCount = tokenize(condition).filter(isUsefulToken).length;

  if (tokenCount <= 2) return 0.8;
  if (tokenCount <= 5) return 0.55;
  return 0.42;
}

function hasTokenOverlap(
  candidate: string,
  reference: string,
  minimum = 0.34,
): boolean {
  const left = new Set(tokenize(candidate).filter(isUsefulToken));
  const right = new Set(tokenize(reference).filter(isUsefulToken));

  if (!left.size || !right.size) {
    return false;
  }

  let overlap = 0;

  for (const token of left) {
    if (right.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(1, Math.min(left.size, right.size)) >= minimum;
}

function hasMeaningfulReference(
  candidate: string,
  normalizedReference: string,
  minimum = 0.5,
): boolean {
  const normalizedCandidate = normalize(candidate);

  if (!normalizedCandidate || !normalizedReference) {
    return false;
  }

  if (normalizedReference.includes(normalizedCandidate)) {
    return true;
  }

  return hasTokenOverlap(normalizedCandidate, normalizedReference, minimum);
}

function branchKey(branch: ScenarioBranch, index: number): string {
  const id = String(branch.id ?? "").trim();
  const condition = String(branch.condition ?? "").trim();

  if (id) {
    return id;
  }

  if (condition) {
    return `condition:${condition.slice(0, 80)}`;
  }

  return `branch_${index + 1}`;
}

function isValidBranch(branch: ScenarioBranch): boolean {
  return Boolean(
    String(branch.id ?? "").trim() ||
      String(branch.condition ?? "").trim() ||
      safeStringArray(branch.expectedCoverageSignals).length > 0,
  );
}

function isGenericBranchId(value: string): boolean {
  return GENERIC_BRANCH_ID_PATTERN.test(normalize(value));
}

function splitSentences(text: string): string[] {
  return String(text ?? "")
    .split(/[.!?;\n]+/g)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function containsAny(text: string, markers: readonly string[]): boolean {
  return markers.some((marker) => containsMarker(text, marker));
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
    (count, marker) => count + countMarker(text, marker),
    0,
  );
}

function countMarker(text: string, marker: string): number {
  const normalizedText = normalize(text);
  const normalizedMarker = normalize(marker);

  if (!normalizedText || !normalizedMarker) {
    return 0;
  }

  if (normalizedMarker.includes(" ")) {
    return normalizedText.match(new RegExp(escapeRegExp(normalizedMarker), "g"))
      ?.length ?? 0;
  }

  return normalizedText.match(
    new RegExp(`\\b${escapeRegExp(normalizedMarker)}\\b`, "g"),
  )?.length ?? 0;
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(/\s+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
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
    .replace(/[–—]/g, "->")
    .replace(/[^a-z0-9_\s:.\-=|>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}