import type { CouncilRiskLevel } from "../council-types";

const RISK_THRESHOLDS: ReadonlyArray<{
  readonly min: number;
  readonly level: CouncilRiskLevel;
}> = [
  { min: 0.85, level: "critical" },
  { min: 0.65, level: "high" },
  { min: 0.35, level: "medium" },
  { min: 0, level: "low" },
];

const RISK_WEIGHT: Record<CouncilRiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export interface NormalizeTextOptions {
  readonly lowercase?: boolean;
  readonly stripDiacritics?: boolean;
  readonly removeZeroWidthChars?: boolean;
  readonly collapseWhitespace?: boolean;
  readonly trim?: boolean;
}

export interface SignalMatch {
  readonly signal: string;
  readonly matched: boolean;
  readonly occurrences: number;
}

export interface SignalScoreResult {
  readonly score: number;
  readonly risk: CouncilRiskLevel;
  readonly totalSignals: number;
  readonly hardSignals: number;
  readonly matchedSignals: string[];
  readonly confidence: number;
}

const DEFAULT_NORMALIZE_OPTIONS: Required<NormalizeTextOptions> = {
  lowercase: true,
  stripDiacritics: true,
  removeZeroWidthChars: true,
  collapseWhitespace: true,
  trim: true,
};

export function normalizeText(
  text: string,
  options: NormalizeTextOptions = {},
): string {
  const config = {
    ...DEFAULT_NORMALIZE_OPTIONS,
    ...options,
  };

  let normalized = String(text ?? "");

  if (config.removeZeroWidthChars) {
    normalized = normalized.replace(/[\u200B-\u200D\uFEFF]/g, "");
  }

  if (config.stripDiacritics) {
    normalized = normalized
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  if (config.lowercase) {
    normalized = normalized.toLowerCase();
  }

  if (config.collapseWhitespace) {
    normalized = normalized.replace(/\s+/g, " ");
  }

  if (config.trim) {
    normalized = normalized.trim();
  }

  return normalized;
}

export function riskFromScore(score: number): CouncilRiskLevel {
  const safeScore = clamp(toFiniteNumber(score), 0, 1);

  return (
    RISK_THRESHOLDS.find((threshold) => safeScore >= threshold.min)?.level ??
    "low"
  );
}

export function confidenceFromSignals(
  totalSignals: number,
  hardSignals: number,
): number {
  const safeTotalSignals = Math.max(0, Math.floor(toFiniteNumber(totalSignals)));
  const safeHardSignals = Math.max(0, Math.floor(toFiniteNumber(hardSignals)));

  const cappedTotalSignals = Math.min(safeTotalSignals, 8);
  const cappedHardSignals = Math.min(safeHardSignals, 5);

  const rawConfidence =
    0.42 + cappedTotalSignals * 0.075 + cappedHardSignals * 0.13;

  return round(clamp(rawConfidence, 0.2, 0.98), 3);
}

export function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const cleaned = String(value ?? "").trim();

    if (!cleaned || seen.has(cleaned)) {
      continue;
    }

    seen.add(cleaned);
    result.push(cleaned);
  }

  return result;
}

export function dedupeNormalized(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const cleaned = String(value ?? "").trim();
    const normalized = normalizeText(cleaned);

    if (!cleaned || !normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(cleaned);
  }

  return result;
}

export function clamp(value: number, min = 0, max = 1): number {
  const safeValue = toFiniteNumber(value);
  const safeMin = toFiniteNumber(min);
  const safeMax = toFiniteNumber(max);

  if (safeMin > safeMax) {
    return Math.min(Math.max(safeValue, safeMax), safeMin);
  }

  return Math.min(Math.max(safeValue, safeMin), safeMax);
}

export function round(value: number, decimals = 3): number {
  const safeDecimals = Math.max(0, Math.floor(toFiniteNumber(decimals)));
  const factor = 10 ** safeDecimals;

  return Math.round(toFiniteNumber(value) * factor) / factor;
}

export function toFiniteNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

export function riskWeight(level: CouncilRiskLevel): number {
  return RISK_WEIGHT[level] ?? 0;
}

export function maxRiskLevel(
  risks: ReadonlyArray<CouncilRiskLevel | undefined | null>,
): CouncilRiskLevel {
  let max: CouncilRiskLevel = "low";

  for (const risk of risks) {
    if (!risk) {
      continue;
    }

    if (riskWeight(risk) > riskWeight(max)) {
      max = risk;
    }
  }

  return max;
}

export function isRiskAtLeast(
  risk: CouncilRiskLevel,
  minimum: CouncilRiskLevel,
): boolean {
  return riskWeight(risk) >= riskWeight(minimum);
}

export function countOccurrences(text: string, term: string): number {
  const normalizedText = normalizeText(text);
  const normalizedTerm = normalizeText(term);

  if (!normalizedText || !normalizedTerm) {
    return 0;
  }

  let count = 0;
  let searchFrom = 0;

  while (searchFrom < normalizedText.length) {
    const index = normalizedText.indexOf(normalizedTerm, searchFrom);

    if (index === -1) {
      break;
    }

    count += 1;
    searchFrom = index + normalizedTerm.length;
  }

  return count;
}

export function containsAnySignal(
  text: string,
  signals: ReadonlyArray<string>,
): boolean {
  return findMatchedSignals(text, signals).length > 0;
}

export function findMatchedSignals(
  text: string,
  signals: ReadonlyArray<string>,
): string[] {
  const normalizedText = normalizeText(text);

  if (!normalizedText || signals.length === 0) {
    return [];
  }

  const matches: string[] = [];

  for (const signal of signals) {
    const normalizedSignal = normalizeText(signal);

    if (!normalizedSignal) {
      continue;
    }

    if (normalizedText.includes(normalizedSignal)) {
      matches.push(signal);
    }
  }

  return dedupeNormalized(matches);
}

export function analyzeSignalMatches(
  text: string,
  signals: ReadonlyArray<string>,
): SignalMatch[] {
  return signals
    .map((signal) => {
      const occurrences = countOccurrences(text, signal);

      return {
        signal,
        matched: occurrences > 0,
        occurrences,
      };
    })
    .filter((match) => match.matched);
}

export function scoreFromSignals(params: {
  readonly text: string;
  readonly softSignals?: ReadonlyArray<string>;
  readonly hardSignals?: ReadonlyArray<string>;
  readonly softWeight?: number;
  readonly hardWeight?: number;
  readonly maxScore?: number;
}): SignalScoreResult {
  const {
    text,
    softSignals = [],
    hardSignals = [],
    softWeight = 0.12,
    hardWeight = 0.22,
    maxScore = 1,
  } = params;

  const softMatches = findMatchedSignals(text, softSignals);
  const hardMatches = findMatchedSignals(text, hardSignals);

  const rawScore =
    softMatches.length * softWeight + hardMatches.length * hardWeight;

  const score = round(clamp(rawScore, 0, maxScore), 3);
  const risk = riskFromScore(score);
  const totalSignals = softMatches.length + hardMatches.length;
  const confidence = confidenceFromSignals(totalSignals, hardMatches.length);

  return {
    score,
    risk,
    totalSignals,
    hardSignals: hardMatches.length,
    matchedSignals: dedupeNormalized([...hardMatches, ...softMatches]),
    confidence,
  };
}

export function weightedAverage(
  values: ReadonlyArray<{
    readonly value: number;
    readonly weight?: number;
  }>,
): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const item of values) {
    const value = clamp(item.value, 0, 1);
    const weight = Math.max(0, toFiniteNumber(item.weight ?? 1));

    if (weight === 0) {
      continue;
    }

    weightedSum += value * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) {
    return 0;
  }

  return round(weightedSum / totalWeight, 3);
}

export function compactList<T>(
  values: ReadonlyArray<T | undefined | null | false | "">,
): T[] {
  return values.filter(Boolean) as T[];
}

export function mergeUniqueLists(
  ...lists: ReadonlyArray<ReadonlyArray<string> | undefined | null>
): string[] {
  return dedupeNormalized(lists.flatMap((list) => list ?? []));
}

export function hasMeaningfulText(text: string, minLength = 2): boolean {
  return normalizeText(text).length >= minLength;
}