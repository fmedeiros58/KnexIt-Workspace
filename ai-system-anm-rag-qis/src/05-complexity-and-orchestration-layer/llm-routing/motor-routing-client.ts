/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: llm-routing/motor-routing-client
 * Responsibility: Execute the short initial motor call used by the orchestrator and return structured routing analysis.
 * Primary Inputs: Normalized request text, recent turns and heuristic snapshot.
 * Primary Outputs: MotorRoutingAnalysis.
 * Upstream Dependencies: infra/llm/vllm-client, zod validation, cache, fallback, normalizer
 * Downstream Dependencies: orchestration-layer, fusion, audit
 * Invariants: The client never returns a final user answer, only routing analysis.
 * Failure Modes: Timeout, invalid schema, invalid JSON and runtime failures degrade to heuristic fallback.
 * Audit Events: motor_routing_attempted, motor_routing_cache_hit, motor_routing_timeout, motor_routing_schema_failure
 * Notes: The same motor/provider is reused, but the prompt is short, structured and low temperature by adapter default.
 */
import { createVllmClient } from "../../infra/llm/vllm-client";
import type { MotorRoutingAnalysis } from "../../bridges/contracts/motor-routing-analysis";
import { buildMotorRoutingCacheKey, readMotorRoutingCache, writeMotorRoutingCache } from "./motor-routing-cache";
import { createMotorRoutingFallback } from "./motor-routing-fallback";
import { normalizeMotorRoutingOutput } from "./motor-routing-normalizer";
import type { HeuristicRoutingSnapshot } from "./routing-analysis-types";

const motorRoutingClient = createVllmClient();
const DEFAULT_TIMEOUT_MS = 2200;
const MAX_ATTEMPTS = 2;

export interface MotorRoutingClientInput {
  normalizedMessage: string;
  recentTurns: Array<{ role: "user" | "assistant"; content: string }>;
  heuristicSnapshot: HeuristicRoutingSnapshot;
}

function buildMotorRoutingPrompt(input: MotorRoutingClientInput): string {
  const recentTurns = input.recentTurns
    .slice(-3)
    .map((item) => `${item.role}: ${item.content}`)
    .join("\n");

  return [
    "You are the ANM routing analyst.",
    "Return strict JSON only. No prose, no markdown, no explanation.",
    "This is NOT the final answer to the user. It is an early routing analysis for the descending pipeline.",
    "Required keys:",
    "primaryIntent, secondaryIntents, complexityBand, complexityConfidence, ambiguityScore, taskType, domainProfile, topicShift, memoryNeed, retrievalNeed, validationNeed, reflectionNeed, responseStyle, expectedOutputShape, recommendedProfiles, profileWeights, riskLevel, needsClarification, proactivityTolerance, estimatedBudgetClass.",
    "Use enums exactly:",
    'complexityBand=[\"very-low\",\"low\",\"medium\",\"high\",\"very-high\"]',
    'memoryNeed/retrievalNeed/validationNeed/reflectionNeed=[\"none\",\"light\",\"standard\",\"heavy\"]',
    'riskLevel=[\"low\",\"medium\",\"high\"]',
    'proactivityTolerance=[\"low\",\"medium\",\"high\"]',
    'estimatedBudgetClass=[\"tight\",\"standard\",\"expanded\"]',
    "",
    "Request:",
    input.normalizedMessage,
    "",
    "Recent turns:",
    recentTurns || "none",
    "",
    "Heuristic hints:",
    JSON.stringify({
      primaryIntent: input.heuristicSnapshot.primaryIntent,
      complexityScore: Number(input.heuristicSnapshot.complexityScore.toFixed(4)),
      ambiguityScore: Number(input.heuristicSnapshot.ambiguityScore.toFixed(4)),
      routeHint: input.heuristicSnapshot.routeHint,
      selectedMode: input.heuristicSnapshot.selectedMode,
      domain: input.heuristicSnapshot.domain,
      semanticModes: input.heuristicSnapshot.semanticModes,
      hasVerifiableSignal: input.heuristicSnapshot.hasVerifiableSignal,
      hasRecencySignal: input.heuristicSnapshot.hasRecencySignal,
      needsRetrieval: input.heuristicSnapshot.needsRetrieval,
      needsMemoryReinforcement: input.heuristicSnapshot.needsMemoryReinforcement,
      validationNeed: input.heuristicSnapshot.validationNeed,
      reflectionNeed: input.heuristicSnapshot.reflectionNeed,
      responseStyle: input.heuristicSnapshot.responseStyle,
      expectedOutputShape: input.heuristicSnapshot.expectedOutputShape,
      topicShift: input.heuristicSnapshot.topicShift,
      needsClarification: input.heuristicSnapshot.needsClarification,
      estimatedBudgetClass: input.heuristicSnapshot.estimatedBudgetClass,
    }),
  ].join("\n");
}

function finalizeMotorAnalysis(
  normalized: ReturnType<typeof normalizeMotorRoutingOutput>,
  rawText: string,
  timeoutMs: number,
  cacheHit: boolean,
): MotorRoutingAnalysis | null {
  if (!normalized.parsed) return null;

  return {
    source: normalized.normalized ? "motor-normalized" : "motor",
    ...normalized.parsed,
    schemaValid: true,
    normalized: normalized.normalized,
    fallbackUsed: false,
    cacheHit,
    timeoutMs,
    errors: [],
    rawText,
  };
}

export async function runMotorRoutingClient(input: MotorRoutingClientInput): Promise<MotorRoutingAnalysis> {
  const timeoutMs = DEFAULT_TIMEOUT_MS;
  const cacheKey = buildMotorRoutingCacheKey({
    normalizedMessage: input.normalizedMessage,
    heuristicSnapshot: input.heuristicSnapshot,
    recentTurns: input.recentTurns.slice(-3),
  });
  const cached = readMotorRoutingCache(cacheKey);
  if (cached) {
    return {
      ...cached,
      cacheHit: true,
    };
  }

  const prompt = buildMotorRoutingPrompt(input);
  let lastError = "unknown_motor_failure";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const rawText = await motorRoutingClient.generate(prompt, { timeoutMs });
      const normalized = normalizeMotorRoutingOutput(rawText);
      const finalized = finalizeMotorAnalysis(normalized, rawText, timeoutMs, false);
      if (!finalized) {
        lastError = normalized.normalized ? "motor_schema_invalid" : "motor_json_invalid";
        continue;
      }
      writeMotorRoutingCache(cacheKey, finalized);
      return finalized;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "motor_runtime_failure";
    }
  }

  return createMotorRoutingFallback({
    snapshot: input.heuristicSnapshot,
    reason: lastError,
    timeoutMs,
  });
}
