/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: execution-profiles/debug-correction-profile
 * Responsibility: Define a regime for bug fixing, diagnosis and correction.
 * Primary Inputs: Profile selector
 * Primary Outputs: debug-correction-profile declaration
 * Upstream Dependencies: profile-helpers
 * Downstream Dependencies: profile-catalog, activation-policy
 * Invariants: Debug work keeps inference and validation active while avoiding unnecessary rhetorical expansion.
 * Failure Modes: None
 * Audit Events: debug_correction_profile_selected
 * Notes: Strongly favors contradiction detection and targeted correction.
 */
import { defineExecutionProfile } from "./profile-helpers";

export const debugCorrectionProfile = defineExecutionProfile({
  id: "debug-correction-profile",
  label: "Debug Correction",
  purpose: "Diagnose and correct bugs or failures with explicit causality and validation.",
  defaultDepth: "deep",
  memoryPolicy: "light",
  retrievalPolicy: "light",
  reflectionPolicy: "standard",
  validationPolicy: "heavy",
  proactivityPolicy: "low",
  humanizationPolicy: "minimal",
  preferredFormat: "diagnostic-text",
  layerIntensities: {
    reflective: "medium",
    inferential: "heavy",
    validation: "heavy",
    "response-calibration": "delivery-light",
  },
  specialConstraints: ["prefer_root_cause", "avoid_generic_fix_lists"],
  suggestedFallback: "technical-analysis-profile",
  tags: ["debug", "correction", "failure-analysis"],
});
