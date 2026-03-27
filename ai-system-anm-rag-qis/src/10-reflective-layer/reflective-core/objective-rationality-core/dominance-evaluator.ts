import type { DominanceSignal, OptionCandidate } from "./objective-rationality-types";

function normalize(value: string): string {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractNumbers(text: string): number[] {
  const matches = text.match(/\d+(?:[.,]\d+)?/g) || [];
  return matches
    .map((item) => Number(item.replace(",", ".")))
    .filter((value) => Number.isFinite(value));
}

function resourceBreadth(text: string): number {
  const normalized = normalize(text);
  const resourceWords = [
    "carne",
    "arroz",
    "feijao",
    "agua",
    "comida",
    "alimento",
    "alimentos",
    "cesta",
    "produto",
    "produtos",
  ];

  let count = 0;
  for (const word of resourceWords) {
    if (normalized.includes(word)) count += 1;
  }
  return count;
}

function quantityScore(numbers: number[]): number {
  return numbers.reduce((acc, n) => acc + n, 0);
}

export function buildOptionCandidate(rawText: string, index: number): OptionCandidate {
  const normalizedText = normalize(rawText);
  const numericSignals = extractNumbers(rawText);

  return {
    index,
    rawText,
    normalizedText,
    numericSignals,
    quantityScore: quantityScore(numericSignals),
    resourceBreadthScore: resourceBreadth(rawText),
  };
}

function composite(candidate: OptionCandidate): number {
  return candidate.quantityScore + candidate.resourceBreadthScore;
}

export function evaluateDominance(options: string[]): DominanceSignal {
  const reasons: string[] = [];

  if (options.length < 2) {
    return {
      detected: false,
      kind: "no_clear_dominance",
      confidence: 0,
      reasons: ["insufficient_options"],
    };
  }

  const candidates = options.map((option, index) => buildOptionCandidate(option, index));

  let best = candidates[0];
  let runnerUp = candidates[0];

  for (const candidate of candidates) {
    if (composite(candidate) > composite(best)) {
      runnerUp = best;
      best = candidate;
      continue;
    }
    if (candidate !== best && composite(candidate) > composite(runnerUp)) {
      runnerUp = candidate;
    }
  }

  const bestComposite = composite(best);
  const secondComposite = composite(runnerUp);

  if (bestComposite <= 0 && secondComposite <= 0) {
    return {
      detected: false,
      kind: "no_clear_dominance",
      confidence: 0.18,
      reasons: ["no_numeric_or_resource_signal"],
    };
  }

  if (bestComposite > secondComposite * 1.4) {
    reasons.push("clear_quantity_advantage");
    return {
      detected: true,
      kind: "strict_dominance",
      winningOptionIndex: best.index,
      confidence: 0.9,
      reasons,
    };
  }

  if (bestComposite > secondComposite) {
    reasons.push("moderate_quantity_advantage");
    return {
      detected: true,
      kind: "probable_dominance",
      winningOptionIndex: best.index,
      confidence: 0.68,
      reasons,
    };
  }

  return {
    detected: false,
    kind: "no_clear_dominance",
    confidence: 0.25,
    reasons: ["balanced_or_ambiguous_options"],
  };
}

