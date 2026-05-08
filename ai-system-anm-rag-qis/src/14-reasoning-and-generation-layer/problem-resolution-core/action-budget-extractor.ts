/**
 * Layer: 14-reasoning-and-generation-layer/problem-resolution-core
 * Module: action-budget-extractor
 * Responsibility: Extract abstract operation budgets and detect budget violations in drafts.
 */

import type { ActionBudget } from "./problem-resolution-types";

export interface ActionBudgetViolation {
  violated: boolean;
  reasons: string[];
  rawSignals: string[];
}

type BudgetActionType = NonNullable<ActionBudget["actionType"]>;

interface BudgetSignal {
  readonly kind: "operation_limit" | "target_limit" | "repeat_policy";
  readonly text: string;
  readonly sentence: string;
}

interface ExpansionRule {
  readonly id: string;
  readonly reason: string;
  readonly markers: readonly string[];
  readonly requiresOperationalContext: boolean;
}

const LIMIT_PATTERNS: readonly RegExp[] = [
  /\b(apenas|somente|s[oó]|só)\s+(1|uma|um)\b/i,
  /\b(1|uma|um)\s+(u[nú]nica|u[nú]nico|unica|unico)\b/i,
  /\b(no\s+m[aá]ximo|exatamente)\s+(1|uma|um)\b/i,
  /\b(uma|um|1)\s+vez\b/i,
  /\b(uma|um|1)\s+u[nú]nica\s+vez\b/i,
  /\b(only|exactly|at\s+most)\s+(one|1)\b/i,
  /\b(one|1)\s+(single|only)\b/i,
  /\b(single|only\s+once|one\s+time|one\s+single)\b/i,
];

const TARGET_LIMIT_PATTERNS: readonly RegExp[] = [
  /\b(de|em|no|na|num|numa|sobre|para)\s+(1|uma|um)\s+(u[nú]nica|u[nú]nico|unica|unico)?\s+[a-zA-ZÀ-ÿ0-9_-]+\b/i,
  /\b(1|uma|um)\s+(u[nú]nica|u[nú]nico|unica|unico)\s+[a-zA-ZÀ-ÿ0-9_-]+\b/i,
  /\b(from|in|on|over|for)\s+(one|1)\s+(single|only)?\s+[a-zA-Z0-9_-]+\b/i,
  /\b(one|1)\s+(single|only)\s+[a-zA-Z0-9_-]+\b/i,
];

const REPEAT_POLICY_PATTERNS: readonly RegExp[] = [
  /\bsem\s+repetir\b/i,
  /\bn[aã]o\s+(pode|deve)?\s*repetir\b/i,
  /\brepeti[cç][aã]o\s+proibida\b/i,
  /\bwithout\s+repeating\b/i,
  /\bcannot\s+repeat\b/i,
  /\bmust\s+not\s+repeat\b/i,
  /\bdo\s+not\s+repeat\b/i,
];

const OPERATIONAL_CONTEXT_MARKERS = [
  "pode",
  "deve",
  "permitido",
  "permite",
  "realizar",
  "executar",
  "fazer",
  "usar",
  "aplicar",
  "procedimento",
  "processo",
  "operacao",
  "operação",
  "acao",
  "ação",
  "tentativa",
  "passo",
  "escolha",
  "observacao",
  "observação",
  "can",
  "may",
  "must",
  "allowed",
  "perform",
  "execute",
  "do",
  "use",
  "apply",
  "procedure",
  "process",
  "operation",
  "action",
  "attempt",
  "step",
  "choice",
  "observation",
];

const EXPANSION_RULES: readonly ExpansionRule[] = [
  {
    id: "repeat_operation",
    reason: "draft suggests repeating a limited operation",
    markers: [
      "repita",
      "repetir",
      "repete",
      "novamente",
      "de novo",
      "mais uma vez",
      "repeat",
      "again",
      "once more",
    ],
    requiresOperationalContext: false,
  },
  {
    id: "one_by_one_expansion",
    reason: "draft expands a singular operation into a one-by-one procedure",
    markers: [
      "uma por vez",
      "um por vez",
      "uma de cada vez",
      "um de cada vez",
      "one by one",
      "one at a time",
    ],
    requiresOperationalContext: false,
  },
  {
    id: "same_process_expansion",
    reason: "draft suggests applying the same process beyond the allowed budget",
    markers: [
      "mesmo processo",
      "mesmo procedimento",
      "mesma operacao",
      "mesma operação",
      "mesmo passo",
      "faca o mesmo",
      "faça o mesmo",
      "do the same",
      "same process",
      "same procedure",
      "same operation",
      "same step",
    ],
    requiresOperationalContext: false,
  },
  {
    id: "each_target_expansion",
    reason: "draft applies the limited operation to each target",
    markers: [
      "cada uma",
      "cada um",
      "cada item",
      "cada entidade",
      "cada alternativa",
      "each",
      "each one",
      "every",
    ],
    requiresOperationalContext: true,
  },
  {
    id: "all_targets_expansion",
    reason: "draft applies the limited operation to all targets",
    markers: [
      "todos",
      "todas",
      "todos os",
      "todas as",
      "all",
      "all of them",
      "every one",
    ],
    requiresOperationalContext: true,
  },
  {
    id: "remaining_targets_expansion",
    reason: "draft applies the limited operation to remaining or other targets",
    markers: [
      "restantes",
      "demais",
      "outras",
      "outros",
      "os outros",
      "as outras",
      "remaining",
      "others",
      "other ones",
      "the others",
      "the remaining",
    ],
    requiresOperationalContext: true,
  },
];

const NEGATION_MARKERS = [
  "nao",
  "não",
  "sem",
  "jamais",
  "nunca",
  "evite",
  "proibido",
  "vedado",
  "do not",
  "dont",
  "don't",
  "cannot",
  "must not",
  "without",
  "never",
  "avoid",
  "forbidden",
  "not allowed",
];

export function extractActionBudget(inputText: string): ActionBudget | undefined {
  const source = String(inputText ?? "").trim();

  if (!source) {
    return undefined;
  }

  const sentences = splitSentencesPreservingText(source);
  const signals = collectBudgetSignals(sentences);

  const operationLimitSignals = signals.filter(
    (signal) => signal.kind === "operation_limit",
  );

  const targetLimitSignals = signals.filter(
    (signal) => signal.kind === "target_limit",
  );

  const repeatPolicySignals = signals.filter(
    (signal) => signal.kind === "repeat_policy",
  );

  if (
    operationLimitSignals.length === 0 &&
    targetLimitSignals.length === 0 &&
    repeatPolicySignals.length === 0
  ) {
    return undefined;
  }

  return {
    maxActions: operationLimitSignals.length > 0 ? 1 : undefined,
    actionType: "unknown" as BudgetActionType,
    targetLimit: targetLimitSignals.length > 0 ? 1 : undefined,
    repeatAllowed: false,
    rawSignals: dedupe(signals.map((signal) => signal.text)),
  };
}

export function detectActionBudgetViolation(
  actionBudget: ActionBudget | undefined,
  draftAnswer: string,
): ActionBudgetViolation {
  if (!hasLimitedOperationBudget(actionBudget)) {
    return {
      violated: false,
      reasons: [],
      rawSignals: [],
    };
  }

  const sentences = splitSentencesPreservingText(draftAnswer);
  const reasons: string[] = [];
  const rawSignals: string[] = [];

  for (const sentence of sentences) {
    const normalizedSentence = normalize(sentence);

    if (!normalizedSentence) {
      continue;
    }

    for (const rule of EXPANSION_RULES) {
      const matchedMarkers = rule.markers.filter((marker) =>
        containsMarker(normalizedSentence, marker),
      );

      if (matchedMarkers.length === 0) {
        continue;
      }

      if (isNegatedExpansion(normalizedSentence, matchedMarkers)) {
        continue;
      }

      if (
        rule.requiresOperationalContext &&
        !hasOperationalContext(normalizedSentence)
      ) {
        continue;
      }

      reasons.push(rule.reason);
      rawSignals.push(
        ...matchedMarkers.map((marker) => `${rule.id}:${marker}`),
      );
    }
  }

  const numericExpansionSignals = detectNumericExpansionSignals(
    normalize(draftAnswer),
  );

  if (numericExpansionSignals.length > 0) {
    reasons.push("draft appears to require more than one operation");
    rawSignals.push(...numericExpansionSignals);
  }

  return {
    violated: reasons.length > 0,
    reasons: dedupe(reasons),
    rawSignals: dedupe(rawSignals),
  };
}

function collectBudgetSignals(sentences: readonly string[]): BudgetSignal[] {
  const signals: BudgetSignal[] = [];

  for (const sentence of sentences) {
    const normalizedSentence = normalize(sentence);

    if (!normalizedSentence) {
      continue;
    }

    const limitMatches = collectRegexMatches(sentence, LIMIT_PATTERNS);
    const targetMatches = collectRegexMatches(sentence, TARGET_LIMIT_PATTERNS);
    const repeatPolicyMatches = collectRegexMatches(
      sentence,
      REPEAT_POLICY_PATTERNS,
    );

    const hasLimit = limitMatches.length > 0;
    const hasTargetLimit = targetMatches.length > 0;
    const hasRepeatPolicy = repeatPolicyMatches.length > 0;

    const isBudgetContext =
      hasOperationalContext(normalizedSentence) ||
      hasPermissionContext(normalizedSentence) ||
      hasRepeatPolicy;

    if (hasLimit && isBudgetContext) {
      for (const match of limitMatches) {
        signals.push({
          kind: "operation_limit",
          text: match,
          sentence,
        });
      }
    }

    if (hasTargetLimit && isBudgetContext) {
      for (const match of targetMatches) {
        signals.push({
          kind: "target_limit",
          text: match,
          sentence,
        });
      }
    }

    if (hasRepeatPolicy) {
      for (const match of repeatPolicyMatches) {
        signals.push({
          kind: "repeat_policy",
          text: match,
          sentence,
        });
      }
    }
  }

  return dedupeBudgetSignals(signals);
}

function hasLimitedOperationBudget(actionBudget: ActionBudget | undefined): boolean {
  if (!actionBudget) {
    return false;
  }

  const maxActions = actionBudget.maxActions ?? Number.POSITIVE_INFINITY;
  const targetLimit = actionBudget.targetLimit ?? Number.POSITIVE_INFINITY;

  return (
    actionBudget.repeatAllowed === false &&
    (maxActions <= 1 || targetLimit <= 1)
  );
}

function hasOperationalContext(normalizedText: string): boolean {
  return OPERATIONAL_CONTEXT_MARKERS.some((marker) =>
    containsMarker(normalizedText, marker),
  );
}

function hasPermissionContext(normalizedText: string): boolean {
  return containsAny(normalizedText, [
    "pode",
    "permitido",
    "permite",
    "autorizado",
    "deve",
    "precisa",
    "can",
    "may",
    "allowed",
    "must",
    "should",
    "need to",
  ]);
}

function isNegatedExpansion(
  normalizedSentence: string,
  matchedMarkers: readonly string[],
): boolean {
  const hasNegation = NEGATION_MARKERS.some((marker) =>
    containsMarker(normalizedSentence, marker),
  );

  if (!hasNegation) {
    return false;
  }

  return matchedMarkers.some((marker) =>
    normalizedSentence.includes(normalize(marker)),
  );
}

function detectNumericExpansionSignals(normalizedDraft: string): string[] {
  const patterns: readonly RegExp[] = [
    /\b(2|duas|dois|3|tres|três|varias|várias|varios|vários|multiple|several)\s+(acoes|ações|operacoes|operações|tentativas|procedimentos|processos|passos|vezes|actions|operations|attempts|procedures|processes|steps|times)\b/g,
    /\b(segunda|segundo|terceira|terceiro|second|third)\s+(acao|ação|operacao|operação|tentativa|procedimento|processo|passo|action|operation|attempt|procedure|process|step)\b/g,
  ];

  const signals: string[] = [];

  for (const pattern of patterns) {
    for (const match of normalizedDraft.matchAll(pattern)) {
      signals.push(`numeric_expansion:${match[0]}`);
    }
  }

  return dedupe(signals);
}

function splitSentencesPreservingText(text: string): string[] {
  return String(text ?? "")
    .split(/(?<=[.!?;:])\s+|\n+/g)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function collectRegexMatches(
  text: string,
  patterns: readonly RegExp[],
): string[] {
  const matches: string[] = [];

  for (const pattern of patterns) {
    const flags = pattern.flags.includes("g")
      ? pattern.flags
      : `${pattern.flags}g`;

    const regex = new RegExp(pattern.source, flags);

    for (const match of text.matchAll(regex)) {
      if (match[0]) {
        matches.push(match[0]);
      }
    }
  }

  return dedupe(matches);
}

function dedupeBudgetSignals(
  signals: readonly BudgetSignal[],
): BudgetSignal[] {
  const seen = new Set<string>();
  const result: BudgetSignal[] = [];

  for (const signal of signals) {
    const key = `${signal.kind}:${normalize(signal.text)}:${normalize(
      signal.sentence,
    )}`;

    if (!signal.text.trim() || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(signal);
  }

  return result;
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

  return new RegExp(`\\b${escapeRegExp(normalizedMarker)}\\b`, "i").test(
    normalizedText,
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
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}