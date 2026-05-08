/**
 * Layer: 14-reasoning-and-generation-layer/problem-resolution-core
 * Module: domain-variable-mapper
 * Responsibility: Build generic variable/domain mapping structures and detect unresolved assignments.
 */

import type { DomainMapping } from "./problem-resolution-types";

export interface UnresolvedAssignmentsResult {
  missingVariables: string[];
  unusedDomains: string[];
  duplicateAssignments: string[];
  violatedAssignmentRules: string[];
  extractedAssignments: Record<string, string>;
  passed: boolean;
}

interface CountExtraction {
  readonly count: number;
  readonly noun: string;
  readonly raw: string;
}

interface AssignmentEvidence {
  readonly variable: string;
  readonly domain: string;
  readonly confidence: number;
  readonly source: "formal" | "operator" | "cooccurrence" | "provided";
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,

  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  três: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
};

const VARIABLE_LIST_LABELS = [
  "variaveis",
  "variáveis",
  "entidades",
  "itens",
  "elementos",
  "alvos",
  "opcoes",
  "opções",
  "objetos",
  "participantes",
  "variables",
  "entities",
  "items",
  "elements",
  "targets",
  "options",
  "objects",
  "participants",
];

const DOMAIN_LIST_LABELS = [
  "valores",
  "dominios",
  "domínios",
  "atributos",
  "resultados",
  "estados",
  "classes",
  "categorias",
  "alternativas",
  "rotulos",
  "rótulos",
  "etiquetas",
  "labels",
  "values",
  "domains",
  "attributes",
  "results",
  "states",
  "classes",
  "categories",
  "alternatives",
];

const VARIABLE_COUNT_NOUNS = [
  "entidade",
  "entidades",
  "item",
  "itens",
  "elemento",
  "elementos",
  "opcao",
  "opcoes",
  "opção",
  "opções",
  "alvo",
  "alvos",
  "objeto",
  "objetos",
  "variavel",
  "variaveis",
  "variável",
  "variáveis",
  "entity",
  "entities",
  "item",
  "items",
  "element",
  "elements",
  "option",
  "options",
  "target",
  "targets",
  "object",
  "objects",
  "variable",
  "variables",
];

const DOMAIN_COUNT_NOUNS = [
  "valor",
  "valores",
  "dominio",
  "dominios",
  "domínio",
  "domínios",
  "atributo",
  "atributos",
  "resultado",
  "resultados",
  "estado",
  "estados",
  "alternativa",
  "alternativas",
  "classe",
  "classes",
  "categoria",
  "categorias",
  "rotulo",
  "rotulos",
  "rótulo",
  "rótulos",
  "etiqueta",
  "etiquetas",
  "value",
  "values",
  "domain",
  "domains",
  "attribute",
  "attributes",
  "result",
  "results",
  "state",
  "states",
  "alternative",
  "alternatives",
  "class",
  "classes",
  "category",
  "categories",
  "label",
  "labels",
];

const GENERIC_COUNT_PATTERN =
  /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|um|uma|dois|duas|tres|três|quatro|cinco|seis|sete|oito|nove|dez)\s+([a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ_-]{2,40})\b/gi;

const SYMBOL_PATTERN = /\b[A-Z][A-Z0-9_]{0,12}\b/g;

const QUOTED_VALUE_PATTERN = /["“”'‘’`]([^"“”'‘’`]{1,80})["“”'‘’`]/g;

const STRUCTURAL_ASSIGNMENT_PATTERNS: RegExp[] = [
  /\b([a-zA-ZÀ-ÿ0-9_ -]{1,80})\s*(?:=|->|=>|:)\s*([a-zA-ZÀ-ÿ0-9_ -]{1,80})\b/g,
  /\b([a-zA-ZÀ-ÿ0-9_ -]{1,80})\s+(?:recebe|fica\s+com|corresponde\s+a|associa(?:do|da)?\s+a|mapeia\s+para|e|é|eh|sera|será|tem|contains|has|is|maps\s+to|assigned\s+to|corresponds\s+to)\s+([a-zA-ZÀ-ÿ0-9_ -]{1,80})\b/gi,
];

const ASSIGNMENT_RULE_PATTERNS: Array<{ id: string; pattern: RegExp }> = [
  {
    id: "each_variable_gets_one_value",
    pattern:
      /\b(cada\s+(entidade|variavel|variável|item|elemento|alvo)\s+(recebe|tem|deve\s+ter)|each\s+(entity|variable|item|element|target)\s+(gets|has|must\s+have))\b/i,
  },
  {
    id: "values_used_once",
    pattern:
      /\b(cada\s+(valor|dominio|domínio|opcao|opção)\s+(e\s+)?(usado|utilizado)?\s*(uma\s+vez)|each\s+(value|domain|option)\s+(is\s+)?used\s+once)\b/i,
  },
  {
    id: "exclusive_assignment",
    pattern:
      /\b(exclusiv|mutuamente\s+exclusiv|um\s+para\s+um|uma\s+para\s+uma|one\s+to\s+one|one-to-one|sem\s+repetir|nao\s+repetir|não\s+repetir|without\s+repetition|no\s+repetition)\b/i,
  },
  {
    id: "determine_all",
    pattern:
      /\b(determinar\s+todos|determinar\s+todas|resolver\s+todos|resolver\s+todas|identificar\s+todos|identificar\s+todas|mapear\s+todos|mapear\s+todas|determine\s+all|resolve\s+all|identify\s+all|map\s+all)\b/i,
  },
  {
    id: "mapping_required",
    pattern:
      /\b(mapear|mapeamento|associar|associacao|associação|atribuir|atribuicao|atribuição|mapping|associate|assignment|assign)\b/i,
  },
];

const RELATION_MARKERS = [
  "=",
  "->",
  "=>",
  ":",
  "recebe",
  "fica com",
  "corresponde a",
  "associado a",
  "associada a",
  "mapeia para",
  "é",
  "eh",
  "sera",
  "será",
  "tem",
  "is",
  "has",
  "contains",
  "maps to",
  "assigned to",
  "corresponds to",
];

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
  "se",
  "caso",
  "quando",
  "entao",
  "então",
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
  "if",
  "when",
  "then",
  "value",
  "entity",
  "item",
  "variable",
  "domain",
]);

export function buildDomainVariableMapping(
  inputText: string,
): DomainMapping | undefined {
  const source = String(inputText ?? "").trim();

  if (!source) {
    return undefined;
  }

  const variableListValues = extractLabeledLists(source, VARIABLE_LIST_LABELS);
  const domainListValues = extractLabeledLists(source, DOMAIN_LIST_LABELS);
  const quotedValues = extractQuotedValues(source);
  const symbolicValues = extractSymbolicCandidates(source);

  const countVariables = extractCountBasedNames(source, VARIABLE_COUNT_NOUNS, "entity");
  const countDomains = extractCountBasedNames(source, DOMAIN_COUNT_NOUNS, "value");

  const inferredCountEntities = inferCountEntitiesFromGenericNumberedNouns(source);
  const inferredDomainsFromColon = inferDomainCandidatesFromColonLists(source);

  const variables = dedupe([
    ...variableListValues,
    ...(variableListValues.length === 0 ? countVariables : []),
    ...(variableListValues.length === 0 && countVariables.length === 0
      ? inferredCountEntities
      : []),
    ...(variableListValues.length === 0 &&
    countVariables.length === 0 &&
    inferredCountEntities.length === 0 &&
    symbolicValues.length >= 2
      ? symbolicValues
      : []),
  ]);

  const domains = dedupe([
    ...domainListValues,
    ...(domainListValues.length === 0 ? countDomains : []),
    ...(domainListValues.length === 0 ? inferredDomainsFromColon : []),
    ...(domainListValues.length === 0 &&
    countDomains.length === 0 &&
    inferredDomainsFromColon.length === 0 &&
    quotedValues.length >= 2
      ? quotedValues
      : []),
  ]);

  const assignmentRules = inferAssignmentRules({
    source,
    variables,
    domains,
  });

  const assignments = extractAssignments(source);

  if (
    variables.length === 0 &&
    domains.length === 0 &&
    assignmentRules.length === 0 &&
    Object.keys(assignments).length === 0
  ) {
    return undefined;
  }

  return {
    variables,
    domains,
    assignments: Object.keys(assignments).length > 0 ? assignments : undefined,
    assignmentRules,
  };
}

export function detectUnresolvedAssignments(
  mapping: DomainMapping | undefined,
  draftAnswer: string,
): UnresolvedAssignmentsResult {
  const safeMapping: DomainMapping = mapping ?? {
    variables: [],
    domains: [],
    assignmentRules: [],
  };

  const normalizedMapping = normalizeDomainMapping(safeMapping);
  const draft = String(draftAnswer ?? "");
  const normalizedDraft = normalize(draft);

  const providedAssignments = normalizeAssignments(safeMapping.assignments);
  const operatorAssignments = extractAssignments(draft);
  const cooccurrenceAssignments = inferAssignmentsByCooccurrence(
    normalizedMapping,
    draft,
  );

  const evidences = mergeAssignmentEvidences([
    ...recordAssignmentsToEvidence(providedAssignments, "provided"),
    ...recordAssignmentsToEvidence(operatorAssignments, "operator"),
    ...recordAssignmentsToEvidence(cooccurrenceAssignments, "cooccurrence"),
  ]);

  const extractedAssignments = evidenceToRecord(evidences);

  const missingVariables = detectMissingVariables({
    variables: normalizedMapping.variables,
    assignments: extractedAssignments,
    normalizedDraft,
    requireExplicitAssignment: requiresExplicitAssignment(normalizedMapping),
  });

  const assignedValues = Object.values(extractedAssignments)
    .map((value) => normalize(value))
    .filter(Boolean);

  const duplicateAssignments = detectDuplicateAssignments({
    assignedValues,
    rules: normalizedMapping.assignmentRules,
  });

  const unusedDomains = detectUnusedDomains({
    domains: normalizedMapping.domains,
    assignedValues,
    normalizedDraft,
    rules: normalizedMapping.assignmentRules,
  });

  const violatedAssignmentRules = detectViolatedAssignmentRules({
    mapping: normalizedMapping,
    missingVariables,
    unusedDomains,
    duplicateAssignments,
    extractedAssignments,
  });

  const passed =
    missingVariables.length === 0 &&
    duplicateAssignments.length === 0 &&
    violatedAssignmentRules.length === 0;

  return {
    missingVariables,
    unusedDomains,
    duplicateAssignments,
    violatedAssignmentRules,
    extractedAssignments,
    passed,
  };
}

function inferAssignmentRules(input: {
  readonly source: string;
  readonly variables: readonly string[];
  readonly domains: readonly string[];
}): string[] {
  const explicitRules = ASSIGNMENT_RULE_PATTERNS.filter((entry) =>
    entry.pattern.test(input.source),
  ).map((entry) => entry.id);

  const inferredRules: string[] = [];

  if (input.variables.length > 0 && input.domains.length > 0) {
    inferredRules.push("mapping_required");
  }

  if (input.variables.length > 1 && input.domains.length > 1) {
    inferredRules.push("determine_all");
  }

  if (
    input.variables.length > 1 &&
    input.domains.length > 1 &&
    input.variables.length === input.domains.length
  ) {
    inferredRules.push("each_variable_gets_one_value");
    inferredRules.push("values_used_once");
    inferredRules.push("exclusive_assignment");
  }

  return dedupe([...explicitRules, ...inferredRules]);
}

function extractLabeledLists(text: string, labels: readonly string[]): string[] {
  const results: string[] = [];

  for (const label of labels) {
    const normalizedLabel = normalize(label);
    const pattern = new RegExp(
      `\\b${escapeRegExp(normalizedLabel)}\\b\\s*(?:sao|são|are|:|-)\\s*([^.!?\\n]{1,240})`,
      "gi",
    );

    const normalizedText = normalizeKeepingSeparators(text);

    for (const match of normalizedText.matchAll(pattern)) {
      results.push(...splitListItems(match[1] ?? ""));
    }
  }

  return dedupe(results);
}

function inferCountEntitiesFromGenericNumberedNouns(text: string): string[] {
  const counts = extractGenericCounts(text);
  const candidate = counts.find((entry) => !isDomainLikeNoun(entry.noun));

  if (!candidate) {
    return [];
  }

  return buildSyntheticNames(singularize(candidate.noun) || "entity", candidate.count);
}

function inferDomainCandidatesFromColonLists(text: string): string[] {
  const normalizedText = normalizeKeepingSeparators(text);
  const matches = [...normalizedText.matchAll(/:\s*([^.!?\n]{3,260})/g)];
  const candidates: string[] = [];

  for (const match of matches) {
    const items = splitListItems(match[1] ?? "");

    if (items.length >= 2 && items.length <= 12) {
      candidates.push(...items);
    }
  }

  return dedupe(candidates);
}

function extractCountBasedNames(
  text: string,
  nouns: readonly string[],
  fallbackPrefix: string,
): string[] {
  const normalizedNouns = new Set(nouns.map((noun) => normalize(noun)));
  const counts = extractGenericCounts(text);

  const match = counts.find((entry) => normalizedNouns.has(normalize(entry.noun)));

  if (!match) {
    return [];
  }

  return buildSyntheticNames(singularize(match.noun) || fallbackPrefix, match.count);
}

function extractGenericCounts(text: string): CountExtraction[] {
  const normalizedText = normalizeKeepingSeparators(text);
  const result: CountExtraction[] = [];

  for (const match of normalizedText.matchAll(GENERIC_COUNT_PATTERN)) {
    const count = parseCount(match[1] ?? "");
    const noun = normalize(match[2] ?? "");

    if (!count || count <= 0 || !noun || STOPWORDS.has(noun)) {
      continue;
    }

    result.push({
      count,
      noun,
      raw: match[0],
    });
  }

  return result;
}

function extractQuotedValues(text: string): string[] {
  const values: string[] = [];

  for (const match of text.matchAll(QUOTED_VALUE_PATTERN)) {
    const cleaned = cleanCandidate(match[1] ?? "");

    if (cleaned) {
      values.push(cleaned);
    }
  }

  return dedupe(values);
}

function extractSymbolicCandidates(text: string): string[] {
  return dedupe(
    (text.match(SYMBOL_PATTERN) ?? [])
      .map((value) => cleanCandidate(value))
      .filter((value) => value.length <= 16),
  );
}

function extractAssignments(text: string): Record<string, string> {
  const assignments: Record<string, string> = {};
  const normalizedText = normalizeKeepingSeparators(text);

  for (const pattern of STRUCTURAL_ASSIGNMENT_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    for (const match of normalizedText.matchAll(regex)) {
      const left = cleanCandidate(match[1] ?? "");
      const right = cleanCandidate(match[2] ?? "");

      if (!isUsefulAssignmentSide(left) || !isUsefulAssignmentSide(right)) {
        continue;
      }

      if (normalize(left) === normalize(right)) {
        continue;
      }

      assignments[normalize(left)] = normalize(right);
    }
  }

  return assignments;
}

function inferAssignmentsByCooccurrence(
  mapping: DomainMapping,
  draftAnswer: string,
): Record<string, string> {
  const assignments: Record<string, string> = {};

  if (mapping.variables.length === 0 || mapping.domains.length === 0) {
    return assignments;
  }

  const sentences = splitSentences(draftAnswer);

  for (const variable of mapping.variables) {
    const variableKey = normalize(variable);
    const candidateEvidence: AssignmentEvidence[] = [];

    for (const sentence of sentences) {
      const normalizedSentence = normalize(sentence);

      if (!hasMeaningfulReference(variable, normalizedSentence)) {
        continue;
      }

      for (const domain of mapping.domains) {
        if (!hasMeaningfulReference(domain, normalizedSentence)) {
          continue;
        }

        const relationScore = containsAny(normalizedSentence, RELATION_MARKERS)
          ? 0.35
          : 0;

        candidateEvidence.push({
          variable: variableKey,
          domain: normalize(domain),
          confidence:
            0.45 +
            relationScore +
            proximityScore(normalizedSentence, variable, domain),
          source: "cooccurrence",
        });
      }
    }

    const best = candidateEvidence.sort(
      (left, right) => right.confidence - left.confidence,
    )[0];

    if (best && best.confidence >= 0.62) {
      assignments[best.variable] = best.domain;
    }
  }

  return assignments;
}

function detectMissingVariables(input: {
  readonly variables: readonly string[];
  readonly assignments: Record<string, string>;
  readonly normalizedDraft: string;
  readonly requireExplicitAssignment: boolean;
}): string[] {
  if (input.variables.length === 0) {
    return [];
  }

  return input.variables.filter((variable) => {
    const key = normalize(variable);

    if (input.assignments[key]) {
      return false;
    }

    if (!input.requireExplicitAssignment && hasMeaningfulReference(variable, input.normalizedDraft)) {
      return false;
    }

    return true;
  });
}

function detectDuplicateAssignments(input: {
  readonly assignedValues: readonly string[];
  readonly rules: readonly string[];
}): string[] {
  if (!requiresExclusivity(input.rules)) {
    return [];
  }

  const counts = new Map<string, number>();

  for (const value of input.assignedValues) {
    if (!value) {
      continue;
    }

    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([value]) => `duplicate_value:${value}`);
}

function detectUnusedDomains(input: {
  readonly domains: readonly string[];
  readonly assignedValues: readonly string[];
  readonly normalizedDraft: string;
  readonly rules: readonly string[];
}): string[] {
  if (!requiresAllDomainsUsed(input.rules)) {
    return [];
  }

  return input.domains.filter((domain) => {
    const key = normalize(domain);

    if (input.assignedValues.includes(key)) {
      return false;
    }

    return !hasMeaningfulReference(domain, input.normalizedDraft);
  });
}

function detectViolatedAssignmentRules(input: {
  readonly mapping: DomainMapping;
  readonly missingVariables: readonly string[];
  readonly unusedDomains: readonly string[];
  readonly duplicateAssignments: readonly string[];
  readonly extractedAssignments: Record<string, string>;
}): string[] {
  const rules = input.mapping.assignmentRules;
  const violations: string[] = [];

  if (input.missingVariables.length > 0 && requiresCompleteAssignment(rules)) {
    violations.push("determine_all");
  }

  if (input.duplicateAssignments.length > 0 && requiresExclusivity(rules)) {
    violations.push("exclusive_assignment");
  }

  if (input.unusedDomains.length > 0 && requiresAllDomainsUsed(rules)) {
    violations.push("values_used_once");
  }

  if (
    hasRule(rules, "mapping_required") &&
    Object.keys(input.extractedAssignments).length === 0 &&
    input.mapping.variables.length > 0
  ) {
    violations.push("mapping_required");
  }

  return dedupe(violations);
}

function normalizeDomainMapping(mapping: DomainMapping): DomainMapping {
  return {
    variables: dedupe(mapping.variables.map((item) => normalize(item))),
    domains: dedupe(mapping.domains.map((item) => normalize(item))),
    assignments: normalizeAssignments(mapping.assignments),
    assignmentRules: dedupe(mapping.assignmentRules.map((item) => normalize(item))),
  };
}

function normalizeAssignments(
  assignments: DomainMapping["assignments"] | undefined,
): Record<string, string> {
  if (!assignments || typeof assignments !== "object") {
    return {};
  }

  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(assignments)) {
    const normalizedKey = normalize(key);
    const normalizedValue = normalize(String(value ?? ""));

    if (!normalizedKey || !normalizedValue) {
      continue;
    }

    normalized[normalizedKey] = normalizedValue;
  }

  return normalized;
}

function recordAssignmentsToEvidence(
  assignments: Record<string, string>,
  source: AssignmentEvidence["source"],
): AssignmentEvidence[] {
  return Object.entries(assignments).map(([variable, domain]) => ({
    variable,
    domain,
    confidence: source === "provided" ? 1 : 0.86,
    source,
  }));
}

function mergeAssignmentEvidences(
  evidences: readonly AssignmentEvidence[],
): AssignmentEvidence[] {
  const bestByVariable = new Map<string, AssignmentEvidence>();

  for (const evidence of evidences) {
    const key = normalize(evidence.variable);
    const previous = bestByVariable.get(key);

    if (!previous || evidence.confidence > previous.confidence) {
      bestByVariable.set(key, evidence);
    }
  }

  return Array.from(bestByVariable.values());
}

function evidenceToRecord(evidences: readonly AssignmentEvidence[]): Record<string, string> {
  const record: Record<string, string> = {};

  for (const evidence of evidences) {
    const variable = normalize(evidence.variable);
    const domain = normalize(evidence.domain);

    if (!variable || !domain) {
      continue;
    }

    record[variable] = domain;
  }

  return record;
}

function requiresExplicitAssignment(mapping: DomainMapping): boolean {
  return (
    hasRule(mapping.assignmentRules, "mapping_required") ||
    hasRule(mapping.assignmentRules, "determine_all") ||
    hasRule(mapping.assignmentRules, "each_variable_gets_one_value")
  );
}

function requiresCompleteAssignment(rules: readonly string[]): boolean {
  return (
    hasRule(rules, "determine_all") ||
    hasRule(rules, "each_variable_gets_one_value")
  );
}

function requiresExclusivity(rules: readonly string[]): boolean {
  return (
    hasRule(rules, "exclusive_assignment") ||
    hasRule(rules, "values_used_once")
  );
}

function requiresAllDomainsUsed(rules: readonly string[]): boolean {
  return hasRule(rules, "values_used_once");
}

function hasRule(rules: readonly string[], ruleId: string): boolean {
  return rules.some((rule) => normalize(rule) === normalize(ruleId));
}

function parseCount(token: string): number | undefined {
  const normalized = normalize(token);

  if (!normalized) {
    return undefined;
  }

  if (/^\d+$/.test(normalized)) {
    return Number.parseInt(normalized, 10);
  }

  return NUMBER_WORDS[normalized];
}

function buildSyntheticNames(prefix: string, count: number): string[] {
  const safeCount = Math.max(0, Math.min(24, count));
  const cleanPrefix = normalize(prefix) || "item";
  const values: string[] = [];

  for (let index = 1; index <= safeCount; index += 1) {
    values.push(`${cleanPrefix}_${index}`);
  }

  return values;
}

function splitListItems(text: string): string[] {
  return dedupe(
    normalizeKeepingSeparators(text)
      .split(/[,;|/]+|\s+(?:e|ou|and|or)\s+/g)
      .map((item) => cleanCandidate(item))
      .filter((item) => item.length > 0)
      .filter((item) => !STOPWORDS.has(normalize(item))),
  );
}

function splitSentences(text: string): string[] {
  return String(text ?? "")
    .split(/[.!?;\n]+/g)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function isDomainLikeNoun(noun: string): boolean {
  const normalized = normalize(noun);

  return DOMAIN_COUNT_NOUNS.map((item) => normalize(item)).includes(normalized);
}

function singularize(noun: string): string {
  const normalized = normalize(noun);

  if (!normalized) {
    return "";
  }

  if (normalized.endsWith("oes")) {
    return normalized.slice(0, -3) + "ao";
  }

  if (normalized.endsWith("ões")) {
    return normalized.slice(0, -3) + "ao";
  }

  if (normalized.endsWith("ies")) {
    return normalized.slice(0, -3) + "y";
  }

  if (normalized.endsWith("s") && normalized.length > 3) {
    return normalized.slice(0, -1);
  }

  return normalized;
}

function cleanCandidate(value: string): string {
  return normalizeKeepingSeparators(value)
    .replace(/^[\s:=-]+|[\s:=-]+$/g, "")
    .replace(/\b(sao|são|are|is|eh|é)\b$/i, "")
    .trim();
}

function isUsefulAssignmentSide(value: string): boolean {
  const normalized = normalize(value);

  if (!normalized || normalized.length < 1) {
    return false;
  }

  if (STOPWORDS.has(normalized)) {
    return false;
  }

  if (normalized.split(" ").length > 8) {
    return false;
  }

  return true;
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

function proximityScore(sentence: string, variable: string, domain: string): number {
  const normalizedSentence = normalize(sentence);
  const variableIndex = normalizedSentence.indexOf(normalize(variable));
  const domainIndex = normalizedSentence.indexOf(normalize(domain));

  if (variableIndex < 0 || domainIndex < 0) {
    return 0;
  }

  const distance = Math.abs(variableIndex - domainIndex);

  if (distance <= 24) return 0.22;
  if (distance <= 64) return 0.14;
  if (distance <= 120) return 0.08;
  return 0.02;
}

function containsAny(text: string, markers: readonly string[]): boolean {
  const normalizedText = normalize(text);

  return markers.some((marker) => {
    const normalizedMarker = normalize(marker);

    if (!normalizedMarker) {
      return false;
    }

    if (normalizedMarker.includes(" ")) {
      return normalizedText.includes(normalizedMarker);
    }

    return new RegExp(`\\b${escapeRegExp(normalizedMarker)}\\b`).test(
      normalizedText,
    );
  });
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(/\s+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .filter((token) => !STOPWORDS.has(token));
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

function normalizeKeepingSeparators(text: string): string {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}