/**
 * Layer: 14-reasoning-and-generation-layer/problem-resolution-core
 * Module: task-reasoning-classifier
 * Responsibility: Estimate how much reasoning discipline the task requires.
 */

import type {
  ProblemResolutionInput,
  ReasoningNeed,
} from "./problem-resolution-types";

interface ReasoningSignalGroup {
  readonly id: string;
  readonly weight: number;
  readonly patterns: readonly RegExp[];
}

interface ReasoningScoreBreakdown {
  readonly score: number;
  readonly hardFormalSignals: number;
  readonly highSignals: number;
  readonly moderateSignals: number;
  readonly tokenCount: number;
  readonly structuralComplexity: number;
  readonly externalStateComplexity: number;
}

const FORMAL_SIGNAL_GROUPS: readonly ReasoningSignalGroup[] = [
  {
    id: "formal_proof",
    weight: 0.72,
    patterns: [
      /\b(formal|rigor|rigoroso|prova|proof|teorema|theorem|axioma|axiom|demonstrar|demonstrate)\b/i,
      /\b(soundness|validade|validity|consisten(?:cia|cy)|completude|completeness)\b/i,
    ],
  },
  {
    id: "logical_closure",
    weight: 0.68,
    patterns: [
      /\b(closure|fechamento|fechar\s+o\s+raciocinio|fechar\s+o\s+raciocínio)\b/i,
      /\b(invariante|invariant|constraint\s+satisfaction|satisfacao\s+de\s+restric|satisfação\s+de\s+restric)\b/i,
      /\b(obrigac(?:ao|oes)\s+de\s+prova|obriga[cç][aã]o\s+de\s+prova|proof\s+obligation)\b/i,
    ],
  },
  {
    id: "strict_constraints",
    weight: 0.62,
    patterns: [
      /\b(nao\s+pode|não\s+pode|cannot|can\s+not|must\s+not|nao\s+deve|não\s+deve)\b/i,
      /\b(obrigatorio|obrigatório|mandatory|required|vedado|proibido|forbidden|not\s+allowed)\b/i,
      /\b(apenas|somente|s[oó]|only|exactly|at\s+most|no\s+maximo|no\s+máximo)\b/i,
    ],
  },
];

const HIGH_SIGNAL_GROUPS: readonly ReasoningSignalGroup[] = [
  {
    id: "conditional_branching",
    weight: 0.48,
    patterns: [
      /\b(se|caso|quando|supondo|if|case|when|assuming|unless|except)\b/i,
      /\b(cenario|cenário|scenario|ramo|branch|possibilidade|possibility)\b/i,
    ],
  },
  {
    id: "alternatives_and_elimination",
    weight: 0.46,
    patterns: [
      /\b(ou|or|alternativa|alternative|hipotese|hipótese|hypothesis)\b/i,
      /\b(eliminac(?:ao|oes)|eliminação|elimination|eliminate|descartar|excluir|remaining|resta|sobra)\b/i,
    ],
  },
  {
    id: "deductive_inference",
    weight: 0.5,
    patterns: [
      /\b(deduz|dedu[cç][aã]o|deduction|infer|inferencia|inferência|inference)\b/i,
      /\b(premissa|premise|conclus[aã]o|conclusion|logo|portanto|therefore|thus)\b/i,
    ],
  },
  {
    id: "validation_or_audit",
    weight: 0.42,
    patterns: [
      /\b(verifique|verificar|check|validar|validate|auditar|audit|testar|test)\b/i,
      /\b(corrigir|corrija|fix|debug|erro|error|problema|issue)\b/i,
    ],
  },
  {
    id: "evaluation_or_critique",
    weight: 0.38,
    patterns: [
      /\b(avaliar|avalie|evaluation|evaluate|critica|crítica|critique)\b/i,
      /\b(contraargumento|contraponto|counterpoint|counterargument|obje[cç][aã]o|objection)\b/i,
    ],
  },
  {
    id: "rules_and_constraints",
    weight: 0.44,
    patterns: [
      /\b(regras?|rule|condic(?:ao|oes)|condi[cç](?:a|õ)es|constraint|restric|restri[cç][aã]o)\b/i,
      /\b(requisito|requirement|criterio|critério|criteria|limite|limit)\b/i,
    ],
  },
  {
    id: "high_impact_reasoning",
    weight: 0.4,
    patterns: [
      /\b(legal|juridic|jur[ií]dic|norma|regulamento|law|policy|compliance|contrato|contract)\b/i,
      /\b(seguranca|segurança|security|financeir|finance|medical|medic|saude|saúde|production|producao|produção)\b/i,
    ],
  },
];

const MODERATE_SIGNAL_GROUPS: readonly ReasoningSignalGroup[] = [
  {
    id: "comparison",
    weight: 0.28,
    patterns: [
      /\b(comparar|compare|comparacao|comparação|comparison|diferen[cç]a|difference)\b/i,
      /\b(melhor|pior|better|worse|trade[-\s]?off|vantagem|desvantagem)\b/i,
    ],
  },
  {
    id: "planning_or_steps",
    weight: 0.26,
    patterns: [
      /\b(plano|plan|roteiro|roadmap|passo\s+a\s+passo|step\s+by\s+step)\b/i,
      /\b(etapas|steps|sequencia|sequência|sequence|pipeline|fluxo|flow)\b/i,
    ],
  },
  {
    id: "implementation",
    weight: 0.3,
    patterns: [
      /\b(codigo|código|code|implement|implementation|arquivo|file|modulo|módulo|module)\b/i,
      /\b(typecheck|typescript|lint|teste|test|build|compile|compilar)\b/i,
    ],
  },
  {
    id: "synthesis_or_rewrite_with_constraints",
    weight: 0.22,
    patterns: [
      /\b(reescreva|rewrite|melhore|improve|ajuste|adjust|refatore|refactor)\b/i,
      /\b(mantenha|preserve|sem alterar|without changing|compatibilidade|compatibility)\b/i,
    ],
  },
];

const LIGHT_SIGNAL_GROUPS: readonly ReasoningSignalGroup[] = [
  {
    id: "simple_explanation",
    weight: 0.12,
    patterns: [
      /\b(explique|explain|o que e|o que é|what is|como funciona|how does)\b/i,
    ],
  },
  {
    id: "small_generation",
    weight: 0.1,
    patterns: [
      /\b(crie|create|gere|generate|escreva|write|resuma|summarize)\b/i,
    ],
  },
];

const STRUCTURAL_MARKERS = [
  "?",
  ":",
  ";",
  "(",
  ")",
  "[",
  "]",
  "{",
  "}",
  "=>",
  "->",
  "=",
  "|",
];

export function classifyTaskReasoningNeed(
  input: ProblemResolutionInput,
): ReasoningNeed {
  const message = String(input.userInput ?? "").trim();

  if (!message) {
    return "none";
  }

  const breakdown = scoreReasoningNeed(input);

  if (
    breakdown.hardFormalSignals >= 2 ||
    breakdown.score >= 2.45 ||
    requiresFormalByExternalState(input, breakdown)
  ) {
    return "formal_required";
  }

  if (
    breakdown.highSignals >= 3 ||
    breakdown.score >= 1.75 ||
    requiresHighReasoning(input, breakdown)
  ) {
    return "high";
  }

  if (
    breakdown.highSignals >= 2 ||
    breakdown.moderateSignals >= 3 ||
    breakdown.score >= 1.08
  ) {
    return "moderate";
  }

  if (
    breakdown.highSignals >= 1 ||
    breakdown.moderateSignals >= 1 ||
    breakdown.score >= 0.42
  ) {
    return "light";
  }

  return "none";
}

function scoreReasoningNeed(
  input: ProblemResolutionInput,
): ReasoningScoreBreakdown {
  const text = buildSearchableInput(input);
  const normalizedText = normalize(text);
  const tokenCount = countTokens(normalizedText);

  const formal = scoreGroups(FORMAL_SIGNAL_GROUPS, normalizedText);
  const high = scoreGroups(HIGH_SIGNAL_GROUPS, normalizedText);
  const moderate = scoreGroups(MODERATE_SIGNAL_GROUPS, normalizedText);
  const light = scoreGroups(LIGHT_SIGNAL_GROUPS, normalizedText);

  const structuralComplexity = computeStructuralComplexity(text, tokenCount);
  const externalStateComplexity = computeExternalStateComplexity(input);

  const score =
    formal.score +
    high.score +
    moderate.score +
    light.score +
    structuralComplexity +
    externalStateComplexity;

  return {
    score,
    hardFormalSignals: formal.matchedGroups,
    highSignals: high.matchedGroups,
    moderateSignals: moderate.matchedGroups,
    tokenCount,
    structuralComplexity,
    externalStateComplexity,
  };
}

function buildSearchableInput(input: ProblemResolutionInput): string {
  return [
    input.userInput,
    input.detectedIntent,
    input.languageHint,
    ...(input.responsePlan ?? []),
    ...(input.reflectiveSignals ?? []),
    ...(input.inferentialSignals ?? []),
    ...(input.metacognitiveSignals ?? []),
    ...(input.epistemicSignals ?? []),
    input.draftAnswer,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

function scoreGroups(
  groups: readonly ReasoningSignalGroup[],
  normalizedText: string,
): {
  score: number;
  matchedGroups: number;
} {
  let score = 0;
  let matchedGroups = 0;

  for (const group of groups) {
    const matches = countPatternMatches(group.patterns, normalizedText);

    if (matches === 0) {
      continue;
    }

    matchedGroups += 1;
    score += group.weight * Math.min(1.6, 1 + (matches - 1) * 0.25);
  }

  return {
    score,
    matchedGroups,
  };
}

function countPatternMatches(
  patterns: readonly RegExp[],
  text: string,
): number {
  return patterns.reduce((total, pattern) => {
    const regex = new RegExp(
      pattern.source,
      pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`,
    );

    return total + Array.from(text.matchAll(regex)).length;
  }, 0);
}

function computeStructuralComplexity(
  text: string,
  tokenCount: number,
): number {
  const lineCount = String(text ?? "")
    .split(/\n+/g)
    .map((line) => line.trim())
    .filter(Boolean).length;

  const markerCount = STRUCTURAL_MARKERS.reduce(
    (count, marker) => count + countSubstring(text, marker),
    0,
  );

  const listOrCodeSignals =
    countRegex(text, /^\s*[-*]\s+/gm) +
    countRegex(text, /^\s*\d+\.\s+/gm) +
    countRegex(text, /```/g) +
    countRegex(text, /\b(import|export|function|interface|type|class|const|let)\b/g);

  const tokenScore = Math.min(0.42, tokenCount / 220);
  const markerScore = Math.min(0.34, markerCount / 30);
  const lineScore = Math.min(0.24, lineCount / 24);
  const structureScore = Math.min(0.38, listOrCodeSignals / 16);

  return round(tokenScore + markerScore + lineScore + structureScore, 4);
}

function computeExternalStateComplexity(
  input: ProblemResolutionInput,
): number {
  let score = 0;

  if ((input.evidence ?? []).length > 0) {
    score += 0.12;
  }

  if ((input.responsePlan ?? []).length > 0) {
    score += 0.1;
  }

  if ((input.reflectiveSignals ?? []).length > 0) {
    score += 0.12;
  }

  if ((input.inferentialSignals ?? []).length > 0) {
    score += 0.16;
  }

  if ((input.epistemicSignals ?? []).length > 0) {
    score += 0.16;
  }

  if ((input.metacognitiveSignals ?? []).length > 0) {
    score += 0.08;
  }

  if (input.taskContract) {
    score += 0.14;
  }

  if (input.draftAnswer && input.draftAnswer.trim().length > 0) {
    score += 0.08;
  }

  return Math.min(0.7, score);
}

function requiresFormalByExternalState(
  input: ProblemResolutionInput,
  breakdown: ReasoningScoreBreakdown,
): boolean {
  const searchable = normalize(buildSearchableInput(input));

  const hasClosureConcern =
    /\b(closure|fechamento|consistency|consistencia|consistência|proof_obligation|obrigacao_de_prova|obrigação_de_prova)\b/.test(
      searchable,
    );

  const hasManySignals =
    breakdown.highSignals >= 3 &&
    breakdown.moderateSignals >= 2 &&
    breakdown.externalStateComplexity >= 0.32;

  return hasClosureConcern || hasManySignals;
}

function requiresHighReasoning(
  input: ProblemResolutionInput,
  breakdown: ReasoningScoreBreakdown,
): boolean {
  const searchable = normalize(buildSearchableInput(input));

  const hasDraftReview =
    Boolean(input.draftAnswer?.trim()) &&
    /\b(avaliar|avalie|verificar|verifique|corrigir|criticar|evaluate|review|check|fix|critique)\b/.test(
      searchable,
    );

  const hasMultipleConstraints =
    countRegex(searchable, /\b(apenas|somente|only|must|deve|nao|não|cannot|sem|without|required|obrigatorio|obrigatório)\b/g) >=
    3;

  const hasBranchAndConstraint =
    /\b(se|caso|if|when|cenario|cenário|scenario)\b/.test(searchable) &&
    /\b(restric|constraint|regra|rule|limite|limit|apenas|only)\b/.test(searchable);

  return (
    hasDraftReview ||
    hasMultipleConstraints ||
    hasBranchAndConstraint ||
    (breakdown.tokenCount >= 120 && breakdown.highSignals >= 2)
  );
}

function countTokens(text: string): number {
  return normalize(text).split(/\s+/g).filter(Boolean).length;
}

function countSubstring(text: string, marker: string): number {
  if (!marker) {
    return 0;
  }

  return String(text ?? "").split(marker).length - 1;
}

function countRegex(text: string, pattern: RegExp): number {
  const regex = new RegExp(
    pattern.source,
    pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`,
  );

  return Array.from(String(text ?? "").matchAll(regex)).length;
}

function normalize(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function round(value: number, decimals = 4): number {
  const factor = 10 ** Math.max(0, Math.floor(decimals));

  return Math.round(value * factor) / factor;
}