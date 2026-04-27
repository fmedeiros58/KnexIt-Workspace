import type { CouncilRiskLevel } from "../council-types";

export interface ContradictionRiskInput {
  readonly draftAnswer: string;
  readonly knownContradictions?: readonly string[];
}

export interface ContradictionRiskResult {
  readonly risk: CouncilRiskLevel;
  readonly score: number;
  readonly contradictions: string[];
}

interface ContradictionSignal {
  readonly id: string;
  readonly penalty: number;
  readonly minimumRisk?: CouncilRiskLevel;
  readonly evidence?: string;
}

const RISK_WEIGHT: Record<CouncilRiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

const CONTRADICTION_RULES: ReadonlyArray<{
  readonly id: string;
  readonly left: readonly string[];
  readonly right: readonly string[];
  readonly penalty: number;
  readonly minimumRisk: CouncilRiskLevel;
}> = [
  {
    id: "always_vs_never",
    left: ["sempre", "always"],
    right: ["nunca", "never", "jamais"],
    penalty: 0.38,
    minimumRisk: "medium",
  },
  {
    id: "certainty_vs_uncertainty",
    left: [
      "com certeza",
      "sem duvida",
      "sem dúvida",
      "definitivamente",
      "certamente",
      "certainly",
      "definitely",
      "undoubtedly",
    ],
    right: [
      "talvez",
      "pode ser",
      "possivelmente",
      "incerto",
      "incerteza",
      "maybe",
      "perhaps",
      "possibly",
      "uncertain",
    ],
    penalty: 0.32,
    minimumRisk: "medium",
  },
  {
    id: "must_vs_must_not",
    left: ["deve", "precisa", "obrigatorio", "obrigatório", "must", "required"],
    right: [
      "nao deve",
      "não deve",
      "nao precisa",
      "não precisa",
      "nao e obrigatorio",
      "não é obrigatório",
      "must not",
      "not required",
      "does not need",
    ],
    penalty: 0.36,
    minimumRisk: "medium",
  },
  {
    id: "can_vs_cannot",
    left: ["pode", "permitido", "permite", "can", "allowed"],
    right: [
      "nao pode",
      "não pode",
      "proibido",
      "nao permitido",
      "não permitido",
      "cannot",
      "can't",
      "not allowed",
      "forbidden",
    ],
    penalty: 0.36,
    minimumRisk: "medium",
  },
  {
    id: "correct_vs_incorrect",
    left: ["correto", "certo", "adequado", "right", "correct"],
    right: ["incorreto", "errado", "inadequado", "wrong", "incorrect"],
    penalty: 0.34,
    minimumRisk: "medium",
  },
  {
    id: "true_vs_false",
    left: ["verdadeiro", "e verdade", "é verdade", "true"],
    right: ["falso", "e falso", "é falso", "false"],
    penalty: 0.34,
    minimumRisk: "medium",
  },
  {
    id: "complete_vs_incomplete",
    left: ["completo", "suficiente", "complete", "sufficient"],
    right: ["incompleto", "insuficiente", "incomplete", "insufficient"],
    penalty: 0.28,
    minimumRisk: "medium",
  },
  {
    id: "approve_vs_block",
    left: ["aprovado", "aprove", "approved", "pode entregar", "can deliver"],
    right: [
      "bloquear",
      "block delivery",
      "nao entregar",
      "não entregar",
      "cannot deliver",
      "reprovado",
    ],
    penalty: 0.4,
    minimumRisk: "high",
  },
  {
    id: "supported_vs_unsupported",
    left: ["com suporte", "fundamentado", "supported", "evidence-based"],
    right: ["sem suporte", "nao fundamentado", "não fundamentado", "unsupported"],
    penalty: 0.32,
    minimumRisk: "medium",
  },
];

export function scoreContradictionRisk(
  input: ContradictionRiskInput,
): ContradictionRiskResult {
  const normalizedDraft = normalize(input.draftAnswer);
  const knownContradictions = dedupe(input.knownContradictions ?? []);

  const signals = dedupeSignals([
    ...signalsFromKnownContradictions(knownContradictions),
    ...detectSentenceLevelContradictions(normalizedDraft),
    ...detectGlobalContradictionSignals(normalizedDraft),
    ...detectNegatedConclusionConflicts(normalizedDraft),
  ]);

  const rawScore = signals.reduce((total, signal) => total + signal.penalty, 0);
  const score = round(clamp(rawScore, 0, 1), 3);

  const scoreRisk = riskFromScore(score);
  const minimumRisk = signals.reduce<CouncilRiskLevel>(
    (highest, signal) =>
      signal.minimumRisk ? maxRisk(highest, signal.minimumRisk) : highest,
    knownContradictions.length > 0 ? "medium" : "low",
  );

  return {
    risk: maxRisk(scoreRisk, minimumRisk),
    score,
    contradictions: dedupe(signals.map((signal) => signal.id)),
  };
}

function signalsFromKnownContradictions(
  knownContradictions: readonly string[],
): ContradictionSignal[] {
  return knownContradictions.map((contradiction) => ({
    id: `known:${contradiction}`,
    penalty: 0.22,
    minimumRisk: "medium",
    evidence: contradiction,
  }));
}

function detectSentenceLevelContradictions(
  normalizedDraft: string,
): ContradictionSignal[] {
  const sentences = splitIntoSentences(normalizedDraft);
  const signals: ContradictionSignal[] = [];

  for (const sentence of sentences) {
    if (sentence.length < 8) {
      continue;
    }

    for (const rule of CONTRADICTION_RULES) {
      if (
        containsAnyMarker(sentence, rule.left) &&
        containsAnyMarker(sentence, rule.right)
      ) {
        signals.push({
          id: rule.id,
          penalty: rule.penalty,
          minimumRisk: rule.minimumRisk,
          evidence: sentence,
        });
      }
    }
  }

  return signals;
}

function detectGlobalContradictionSignals(
  normalizedDraft: string,
): ContradictionSignal[] {
  const signals: ContradictionSignal[] = [];

  if (
    hasPhrase(normalizedDraft, "nao ha contradicao") &&
    (hasPhrase(normalizedDraft, "contradicao") ||
      hasPhrase(normalizedDraft, "inconsistencia"))
  ) {
    const contradictionMentions = countMarkerHits(normalizedDraft, [
      "contradicao",
      "contraditório",
      "contraditorio",
      "inconsistencia",
      "inconsistência",
      "contradiction",
      "inconsistency",
    ]);

    if (contradictionMentions >= 2) {
      signals.push({
        id: "denies_contradiction_while_reporting_contradiction",
        penalty: 0.22,
        minimumRisk: "medium",
      });
    }
  }

  if (
    containsAnyMarker(normalizedDraft, ["sem dados", "sem evidencia", "sem evidência", "without evidence"]) &&
    containsAnyMarker(normalizedDraft, [
      "com certeza",
      "sem duvida",
      "sem dúvida",
      "definitivamente",
      "certainly",
      "definitely",
    ])
  ) {
    signals.push({
      id: "no_evidence_vs_certainty",
      penalty: 0.3,
      minimumRisk: "medium",
    });
  }

  if (
    containsAnyMarker(normalizedDraft, ["nao e possivel concluir", "não é possível concluir", "cannot conclude"]) &&
    containsAnyMarker(normalizedDraft, ["portanto", "logo", "conclui-se", "therefore", "thus"])
  ) {
    signals.push({
      id: "cannot_conclude_vs_final_conclusion",
      penalty: 0.28,
      minimumRisk: "medium",
    });
  }

  return signals;
}

function detectNegatedConclusionConflicts(
  normalizedDraft: string,
): ContradictionSignal[] {
  const signals: ContradictionSignal[] = [];

  const firstConclusion = extractConclusionPolarity(normalizedDraft, [
    "a resposta esta correta",
    "a resposta está correta",
    "isso esta correto",
    "isso está correto",
    "esta certo",
    "está certo",
    "is correct",
    "is right",
  ]);

  const oppositeConclusion = extractConclusionPolarity(normalizedDraft, [
    "a resposta esta errada",
    "a resposta está errada",
    "isso esta incorreto",
    "isso está incorreto",
    "esta errado",
    "está errado",
    "is wrong",
    "is incorrect",
  ]);

  if (firstConclusion && oppositeConclusion) {
    signals.push({
      id: "conflicting_answer_evaluation",
      penalty: 0.38,
      minimumRisk: "high",
    });
  }

  const recommends = containsAnyMarker(normalizedDraft, [
    "recomendo",
    "deve fazer",
    "deve usar",
    "you should",
    "i recommend",
  ]);

  const discourages = containsAnyMarker(normalizedDraft, [
    "nao recomendo",
    "não recomendo",
    "nao deve fazer",
    "não deve fazer",
    "nao deve usar",
    "não deve usar",
    "you should not",
    "i do not recommend",
  ]);

  if (recommends && discourages) {
    signals.push({
      id: "recommendation_vs_non_recommendation",
      penalty: 0.34,
      minimumRisk: "medium",
    });
  }

  return signals;
}

function extractConclusionPolarity(
  normalizedDraft: string,
  markers: readonly string[],
): boolean {
  return markers.some((marker) => hasPhrase(normalizedDraft, marker));
}

function splitIntoSentences(normalizedDraft: string): string[] {
  return normalizedDraft
    .split(/(?<=[.!?;:])\s+|\n+/g)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function containsAnyMarker(text: string, markers: readonly string[]): boolean {
  return markers.some((marker) => containsMarker(text, marker));
}

function containsMarker(text: string, marker: string): boolean {
  const normalizedMarker = normalize(marker);

  if (!text || !normalizedMarker) {
    return false;
  }

  if (normalizedMarker.includes(" ")) {
    return text.includes(normalizedMarker);
  }

  const regex = new RegExp(`\\b${escapeRegExp(normalizedMarker)}\\b`, "i");
  return regex.test(text);
}

function hasPhrase(text: string, phrase: string): boolean {
  return text.includes(normalize(phrase));
}

function countMarkerHits(text: string, markers: readonly string[]): number {
  return markers.reduce(
    (count, marker) => count + (containsMarker(text, marker) ? 1 : 0),
    0,
  );
}

function riskFromScore(score: number): CouncilRiskLevel {
  if (score >= 0.86) return "critical";
  if (score >= 0.66) return "high";
  if (score >= 0.38) return "medium";
  return "low";
}

function maxRisk(
  left: CouncilRiskLevel,
  right: CouncilRiskLevel,
): CouncilRiskLevel {
  return riskWeight(left) >= riskWeight(right) ? left : right;
}

function riskWeight(risk: CouncilRiskLevel): number {
  switch (risk) {
    case "critical":
      return 3;
    case "high":
      return 2;
    case "medium":
      return 1;
    case "low":
    default:
      return 0;
  }
}

function normalize(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeSignals(
  signals: readonly ContradictionSignal[],
): ContradictionSignal[] {
  const byId = new Map<string, ContradictionSignal>();

  for (const signal of signals) {
    const existing = byId.get(signal.id);

    if (!existing) {
      byId.set(signal.id, signal);
      continue;
    }

    byId.set(signal.id, {
      id: signal.id,
      penalty: Math.max(existing.penalty, signal.penalty),
      minimumRisk: signal.minimumRisk
        ? maxRisk(existing.minimumRisk ?? "low", signal.minimumRisk)
        : existing.minimumRisk,
      evidence: existing.evidence ?? signal.evidence,
    });
  }

  return Array.from(byId.values());
}

function dedupe(values: readonly string[]): string[] {
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, decimals = 3): number {
  const factor = 10 ** Math.max(0, Math.floor(decimals));

  return Math.round(value * factor) / factor;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}