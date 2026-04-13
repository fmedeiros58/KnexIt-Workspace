/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: llm-routing/motor-routing-normalizer
 * Responsibility: Extract, normalize and validate JSON-like motor routing payloads.
 * Primary Inputs: Raw motor text output.
 * Primary Outputs: Normalized motor routing candidates or null.
 * Upstream Dependencies: motor-routing-schema
 * Downstream Dependencies: motor-routing-client
 * Invariants: Normalization remains lightweight and never fabricates final user-facing answers.
 * Failure Modes: Unparseable outputs return null and trigger heuristic fallback.
 * Audit Events: motor_output_normalized, motor_output_parse_failed
 * Notes: Snake_case keys and stringly-typed lists are normalized into the canonical schema.
 */
import { motorRoutingSchema, type MotorRoutingSchemaOutput } from "./motor-routing-schema";

function extractJsonFragment(text: string): string | null {
  const source = `${text || ""}`.trim();
  const first = source.indexOf("{");
  const last = source.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  return source.slice(first, last + 1);
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => `${item}`.trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/[,\n|;]/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function getFirstString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeObject(input: Record<string, unknown>): Record<string, unknown> {
  const primaryIntent = input.primaryIntent ?? input.primary_intent ?? input.intent ?? "chat";
  const secondaryIntents = input.secondaryIntents ?? input.secondary_intents ?? input.secondary ?? [];
  const complexityBand = input.complexityBand ?? input.complexity_band ?? "medium";
  const complexityConfidence = Number(input.complexityConfidence ?? input.complexity_confidence ?? 0.5);
  const ambiguityScore = Number(input.ambiguityScore ?? input.ambiguity_score ?? 0.35);
  const domainRaw = input.domainProfile ?? input.domain_profile ?? input.domain ?? "general";
  const domainProfile = typeof domainRaw === "string"
    ? { primary: domainRaw.trim() || "general", secondary: [] }
    : {
        primary: getFirstString((domainRaw as Record<string, unknown>)?.primary, "general"),
        secondary: toStringArray((domainRaw as Record<string, unknown>)?.secondary),
      };

  const weightsRaw = input.profileWeights ?? input.profile_weights ?? {};
  const profileWeights = typeof weightsRaw === "object" && weightsRaw
    ? Object.fromEntries(
        Object.entries(weightsRaw as Record<string, unknown>)
          .map(([key, value]) => [key, Number(value)])
          .filter(([, value]) => Number.isFinite(value)),
      )
    : {};

  return {
    primaryIntent: getFirstString(primaryIntent, "chat"),
    secondaryIntents: toStringArray(secondaryIntents),
    complexityBand: getFirstString(complexityBand, "medium"),
    complexityConfidence: Number.isFinite(complexityConfidence) ? complexityConfidence : 0.5,
    ambiguityScore: Number.isFinite(ambiguityScore) ? ambiguityScore : 0.35,
    taskType: getFirstString(input.taskType ?? input.task_type, "general_request"),
    domainProfile,
    topicShift: Boolean(input.topicShift ?? input.topic_shift),
    memoryNeed: getFirstString(input.memoryNeed ?? input.memory_need, "light"),
    retrievalNeed: getFirstString(input.retrievalNeed ?? input.retrieval_need, "light"),
    validationNeed: getFirstString(input.validationNeed ?? input.validation_need, "standard"),
    reflectionNeed: getFirstString(input.reflectionNeed ?? input.reflection_need, "light"),
    responseStyle: getFirstString(input.responseStyle ?? input.response_style, "balanced"),
    expectedOutputShape: toStringArray(input.expectedOutputShape ?? input.expected_output_shape),
    recommendedProfiles: toStringArray(input.recommendedProfiles ?? input.recommended_profiles),
    profileWeights,
    riskLevel: getFirstString(input.riskLevel ?? input.risk_level, "medium"),
    needsClarification: Boolean(input.needsClarification ?? input.needs_clarification),
    proactivityTolerance: getFirstString(input.proactivityTolerance ?? input.proactivity_tolerance, "medium"),
    estimatedBudgetClass: getFirstString(input.estimatedBudgetClass ?? input.estimated_budget_class, "standard"),
  };
}

export interface NormalizedMotorRoutingResult {
  normalized: boolean;
  parsed: MotorRoutingSchemaOutput | null;
  rawObject: Record<string, unknown> | null;
}

export function normalizeMotorRoutingOutput(rawText: string): NormalizedMotorRoutingResult {
  const jsonFragment = extractJsonFragment(rawText);
  if (!jsonFragment) {
    return { normalized: false, parsed: null, rawObject: null };
  }

  try {
    const parsed = JSON.parse(jsonFragment) as Record<string, unknown>;
    const normalized = normalizeObject(parsed);
    const schemaParsed = motorRoutingSchema.safeParse(normalized);
    if (!schemaParsed.success) {
      return { normalized: true, parsed: null, rawObject: normalized };
    }
    return { normalized: true, parsed: schemaParsed.data, rawObject: normalized };
  } catch {
    return { normalized: false, parsed: null, rawObject: null };
  }
}
