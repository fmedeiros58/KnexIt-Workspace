/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: execution-profiles/high-caution-validation-profile
 * Responsibility: Define a high-caution regime for risky or high-stakes prompts.
 * Primary Inputs: Profile selector
 * Primary Outputs: high-caution-validation-profile declaration
 * Upstream Dependencies: profile-helpers
 * Downstream Dependencies: profile-catalog, activation-policy
 * Invariants: High-caution flows keep validation, epistemic integration and calibration elevated.
 * Failure Modes: None
 * Audit Events: high_caution_validation_profile_selected
 * Notes: This profile favors safety, validation and conservative delivery.
 */
import { defineExecutionProfile } from "./profile-helpers";

export const highCautionValidationProfile = defineExecutionProfile({
  id: "high-caution-validation-profile",
  label: "High Caution Validation",
  purpose: "Increase validation and calibration when risk or uncertainty is high.",
  defaultDepth: "deep",
  memoryPolicy: "light",
  retrievalPolicy: "standard",
  reflectionPolicy: "standard",
  validationPolicy: "heavy",
  proactivityPolicy: "low",
  humanizationPolicy: "minimal",
  preferredFormat: "validated-text",
  layerIntensities: {
    knowledge: "retrieval-heavy",
    reflective: "medium",
    "epistemic-integration": "epistemic-heavy",
    validation: "heavy",
    "response-calibration": "heavy",
  },
  specialConstraints: ["prefer_conservative_claims"],
  suggestedFallback: "retrieval-augmented-profile",
  tags: ["risk", "validation", "caution"],
});
