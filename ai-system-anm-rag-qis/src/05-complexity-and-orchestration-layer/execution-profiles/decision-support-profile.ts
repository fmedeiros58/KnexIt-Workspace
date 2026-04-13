/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: execution-profiles/decision-support-profile
 * Responsibility: Define a regime for decision support under constraints and risk.
 * Primary Inputs: Profile selector
 * Primary Outputs: decision-support-profile declaration
 * Upstream Dependencies: profile-helpers
 * Downstream Dependencies: profile-catalog, activation-policy
 * Invariants: Decision support keeps comparison, validation and structured delivery active.
 * Failure Modes: None
 * Audit Events: decision_support_profile_selected
 * Notes: Useful when the user needs a reasoned recommendation rather than free-form analysis.
 */
import { defineExecutionProfile } from "./profile-helpers";

export const decisionSupportProfile = defineExecutionProfile({
  id: "decision-support-profile",
  label: "Decision Support",
  purpose: "Support decisions with alternatives, trade-offs and risk-aware recommendations.",
  defaultDepth: "deep",
  memoryPolicy: "light",
  retrievalPolicy: "standard",
  reflectionPolicy: "standard",
  validationPolicy: "heavy",
  proactivityPolicy: "low",
  humanizationPolicy: "minimal",
  preferredFormat: "decision-memo",
  layerIntensities: {
    "deliberative-task-contract": "medium",
    inferential: "heavy",
    reflective: "medium",
    validation: "heavy",
    structure: "heavy",
  },
  specialConstraints: ["require_tradeoff_visibility"],
  suggestedFallback: "reflective-comparison-profile",
  tags: ["decision", "support", "recommendation"],
});
