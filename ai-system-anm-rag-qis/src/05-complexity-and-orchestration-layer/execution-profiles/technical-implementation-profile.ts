/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: execution-profiles/technical-implementation-profile
 * Responsibility: Define a regime for implementation-heavy technical requests.
 * Primary Inputs: Profile selector
 * Primary Outputs: technical-implementation-profile declaration
 * Upstream Dependencies: profile-helpers
 * Downstream Dependencies: profile-catalog, activation-policy
 * Invariants: Implementation requests keep planning, structure and validation strong.
 * Failure Modes: None
 * Audit Events: technical_implementation_profile_selected
 * Notes: Biased toward execution planning and concrete output shape.
 */
import { defineExecutionProfile } from "./profile-helpers";

export const technicalImplementationProfile = defineExecutionProfile({
  id: "technical-implementation-profile",
  label: "Technical Implementation",
  purpose: "Support concrete implementation work with stronger planning and validation.",
  defaultDepth: "deep",
  memoryPolicy: "standard",
  retrievalPolicy: "light",
  reflectionPolicy: "light",
  validationPolicy: "heavy",
  proactivityPolicy: "low",
  humanizationPolicy: "minimal",
  preferredFormat: "stepwise-text",
  layerIntensities: {
    "response-planning": "heavy",
    inferential: "heavy",
    structure: "heavy",
    validation: "heavy",
    "response-calibration": "delivery-light",
  },
  specialConstraints: ["favor_actionable_implementation"],
  suggestedFallback: "technical-analysis-profile",
  tags: ["technical", "implementation", "coding"],
});
