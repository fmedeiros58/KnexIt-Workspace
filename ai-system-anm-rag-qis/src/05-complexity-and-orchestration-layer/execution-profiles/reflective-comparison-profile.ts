/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: execution-profiles/reflective-comparison-profile
 * Responsibility: Define a regime for comparisons that need reflective interpretation.
 * Primary Inputs: Profile selector
 * Primary Outputs: reflective-comparison-profile declaration
 * Upstream Dependencies: profile-helpers
 * Downstream Dependencies: profile-catalog, activation-policy
 * Invariants: Reflective comparison keeps reflection and inference synchronized.
 * Failure Modes: None
 * Audit Events: reflective_comparison_profile_selected
 * Notes: Suitable for compare, evaluate and alternative framing prompts.
 */
import { defineExecutionProfile } from "./profile-helpers";

export const reflectiveComparisonProfile = defineExecutionProfile({
  id: "reflective-comparison-profile",
  label: "Reflective Comparison",
  purpose: "Compare alternatives with explicit reflection, trade-offs and caveats.",
  defaultDepth: "deep",
  memoryPolicy: "light",
  retrievalPolicy: "light",
  reflectionPolicy: "heavy",
  validationPolicy: "standard",
  proactivityPolicy: "low",
  humanizationPolicy: "minimal",
  preferredFormat: "comparative-text",
  layerIntensities: {
    reflective: "heavy",
    inferential: "heavy",
    metacognitive: "medium",
    validation: "medium",
  },
  specialConstraints: ["surface_tradeoffs"],
  suggestedFallback: "technical-analysis-profile",
  tags: ["comparison", "reflection", "tradeoffs"],
});
