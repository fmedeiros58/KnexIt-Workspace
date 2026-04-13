/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: execution-profiles/constraint-heavy-instruction-profile
 * Responsibility: Define a regime for prompts with many explicit constraints and hard rules.
 * Primary Inputs: Profile selector
 * Primary Outputs: constraint-heavy-instruction-profile declaration
 * Upstream Dependencies: profile-helpers
 * Downstream Dependencies: profile-catalog, activation-policy
 * Invariants: Constraint-heavy prompts strengthen planning, validation and calibration.
 * Failure Modes: None
 * Audit Events: constraint_heavy_instruction_profile_selected
 * Notes: Designed for execution under rigid user instructions.
 */
import { defineExecutionProfile } from "./profile-helpers";

export const constraintHeavyInstructionProfile = defineExecutionProfile({
  id: "constraint-heavy-instruction-profile",
  label: "Constraint Heavy Instruction",
  purpose: "Handle dense instruction sets with strong planning and compliance.",
  defaultDepth: "deep",
  memoryPolicy: "light",
  retrievalPolicy: "light",
  reflectionPolicy: "light",
  validationPolicy: "heavy",
  proactivityPolicy: "low",
  humanizationPolicy: "minimal",
  preferredFormat: "constraint-compliant-text",
  layerIntensities: {
    "deliberative-task-contract": "heavy",
    "response-planning": "heavy",
    validation: "heavy",
    "response-calibration": "medium",
  },
  specialConstraints: ["maximize_constraint_compliance"],
  suggestedFallback: "technical-implementation-profile",
  tags: ["constraints", "compliance", "instruction"],
});
