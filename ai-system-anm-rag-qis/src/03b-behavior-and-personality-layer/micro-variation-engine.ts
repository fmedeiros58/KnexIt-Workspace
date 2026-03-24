/**
 * Responsabilidade do arquivo:
 * - Gerar microvariacao de superficie textual de forma deterministica.
 * - Reduzir repeticao de formulas sem aleatoriedade burra.
 * - Preservar identidade e sobriedade conforme contexto.
 */
import type { BehaviorPersonalityInput } from "./behavior-and-personality-types";

export interface MicroVariationResult {
  openingCue: string;
  transitionCue: string;
  closingCue: string;
  note: string;
}

const OPENINGS_DIRECT = [
  "Certo.",
  "Entendi.",
  "Perfeito.",
  "Vamos direto ao ponto.",
];

const OPENINGS_WARM = [
  "Faz sentido.",
  "Boa.",
  "Tem um ponto importante aqui.",
  "Dá para organizar isso melhor.",
];

const TRANSITIONS_CLEAN = [
  "Em seguida,",
  "No ponto central,",
  "De forma objetiva,",
  "Na pratica,",
];

const TRANSITIONS_SUPPORTIVE = [
  "Para facilitar,",
  "Pra ficar claro,",
  "Com isso em mente,",
  "Nesse contexto,",
];

const CLOSINGS_NEUTRAL = [
  "Se quiser, eu detalho o proximo passo.",
  "Se fizer sentido, eu aprofundo em seguida.",
  "Se precisar, eu adapto para o nivel de detalhe que voce quiser.",
  "Se quiser, eu reformulo em um formato mais direto.",
];

function fold(text: string): string {
  return `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hash32(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickStable(pool: string[], seed: string, blocked: string[] = []): string {
  if (!pool.length) return "";
  const blockedSet = new Set(blocked.map((item) => fold(item)));
  const candidates = pool.filter((item) => !blockedSet.has(fold(item)));
  const effectivePool = candidates.length ? candidates : pool;
  const index = hash32(seed) % effectivePool.length;
  return effectivePool[index];
}

export function generateMicroVariation(
  input: BehaviorPersonalityInput,
  targets: {
    targetCasualness: number;
    targetSocialPresence: number;
    targetRestraint: number;
  },
): MicroVariationResult {
  const recentOpenings = Array.isArray(input.contextualSignals.recentOpenings)
    ? input.contextualSignals.recentOpenings
    : [];
  const seedBase = [
    input.contextualSignals.activeTopic || "general",
    input.contextualSignals.normalizedMessage || "",
    input.interactionType,
    input.taskType,
    `${Math.round(targets.targetRestraint * 100)}`,
  ].join("|");

  const shouldUseWarmOpenings =
    targets.targetCasualness >= 0.28 &&
    targets.targetSocialPresence >= 0.46 &&
    targets.targetRestraint <= 0.78;
  const openingPool = shouldUseWarmOpenings ? OPENINGS_WARM : OPENINGS_DIRECT;
  const transitionPool = targets.targetRestraint >= 0.7 ? TRANSITIONS_CLEAN : TRANSITIONS_SUPPORTIVE;

  return {
    openingCue: pickStable(openingPool, `${seedBase}:opening`, recentOpenings),
    transitionCue: pickStable(transitionPool, `${seedBase}:transition`),
    closingCue: pickStable(CLOSINGS_NEUTRAL, `${seedBase}:closing`),
    note: shouldUseWarmOpenings ? "micro_variation_warm_channel" : "micro_variation_direct_channel",
  };
}

