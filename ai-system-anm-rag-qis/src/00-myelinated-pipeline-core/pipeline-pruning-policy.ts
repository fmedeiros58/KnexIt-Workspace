/**
 * Responsabilidade do arquivo:
 * - Definir limites de pruning por perfil de custo (aggressive/moderate/minimal).
 * - Identificar constraints criticas que nao devem ser descartadas.
 * - Servir como politica unica para state-pruner.
 */
export interface PruningLimits {
  trace: number;
  activeConstraints: number;
  activeContext: number;
  retrievedSources: number;
  retrievedEvidence: number;
  scenarioSet: number;
  hypothesisSet: number;
  criticalCaveats: number;
  reflectiveItems: number;
}

export const PRUNING_LIMITS: Record<"aggressive" | "moderate" | "minimal", PruningLimits> = {
  aggressive: {
    trace: 80,
    activeConstraints: 24,
    activeContext: 6,
    retrievedSources: 6,
    retrievedEvidence: 10,
    scenarioSet: 4,
    hypothesisSet: 4,
    criticalCaveats: 4,
    reflectiveItems: 4,
  },
  moderate: {
    trace: 140,
    activeConstraints: 36,
    activeContext: 10,
    retrievedSources: 10,
    retrievedEvidence: 16,
    scenarioSet: 8,
    hypothesisSet: 8,
    criticalCaveats: 8,
    reflectiveItems: 8,
  },
  minimal: {
    trace: 220,
    activeConstraints: 48,
    activeContext: 16,
    retrievedSources: 16,
    retrievedEvidence: 24,
    scenarioSet: 12,
    hypothesisSet: 12,
    criticalCaveats: 12,
    reflectiveItems: 12,
  },
};

export const CRITICAL_CONSTRAINT_PATTERNS: RegExp[] = [
  /^safety_/i,
  /^safety:/i,
  /^fallback:/i,
  /^retry_/i,
  /^retry:/i,
  /^error_category:/i,
  /^memory_regulatory_/i,
  /^memory:/i,
  /^language_state_warning:/i,
  /^guardrail:/i,
  /block/i,
  /malicious/i,
  /prompt_injection/i,
  /harmful/i,
  /restricted/i,
];
