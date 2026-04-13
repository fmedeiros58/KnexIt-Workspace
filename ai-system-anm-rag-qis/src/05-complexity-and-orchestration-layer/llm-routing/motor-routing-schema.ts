/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: llm-routing/motor-routing-schema
 * Responsibility: Validate the structured output of the initial short motor call.
 * Primary Inputs: Parsed JSON candidates returned by the motor.
 * Primary Outputs: Zod-validated routing analysis payloads.
 * Upstream Dependencies: zod
 * Downstream Dependencies: motor-routing-normalizer, motor-routing-client
 * Invariants: Only structured analysis fields are accepted; no final answer content belongs here.
 * Failure Modes: Invalid payloads must be normalized or rejected into heuristic fallback.
 * Audit Events: motor_schema_validated, motor_schema_rejected
 * Notes: The schema intentionally mirrors the adaptive orchestration contract surface.
 */
import { z } from "zod";

export const motorRoutingSchema = z.object({
  primaryIntent: z.string().min(1),
  secondaryIntents: z.array(z.string()).default([]),
  complexityBand: z.enum(["very-low", "low", "medium", "high", "very-high"]),
  complexityConfidence: z.number().min(0).max(1),
  ambiguityScore: z.number().min(0).max(1),
  taskType: z.string().min(1),
  domainProfile: z.object({
    primary: z.string().min(1),
    secondary: z.array(z.string()).default([]),
  }),
  topicShift: z.boolean(),
  memoryNeed: z.enum(["none", "light", "standard", "heavy"]),
  retrievalNeed: z.enum(["none", "light", "standard", "heavy"]),
  validationNeed: z.enum(["none", "light", "standard", "heavy"]),
  reflectionNeed: z.enum(["none", "light", "standard", "heavy"]),
  responseStyle: z.string().min(1),
  expectedOutputShape: z.array(z.string()).default([]),
  recommendedProfiles: z.array(z.string()).default([]),
  profileWeights: z.record(z.string(), z.number().min(0).max(1)).default({}),
  riskLevel: z.enum(["low", "medium", "high"]),
  needsClarification: z.boolean(),
  proactivityTolerance: z.enum(["low", "medium", "high"]),
  estimatedBudgetClass: z.enum(["tight", "standard", "expanded"]),
});

export type MotorRoutingSchemaOutput = z.infer<typeof motorRoutingSchema>;
