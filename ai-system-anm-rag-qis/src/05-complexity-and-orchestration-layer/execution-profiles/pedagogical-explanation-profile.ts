/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: execution-profiles/pedagogical-explanation-profile
 * Responsibility: Define a didactic explanation regime with structured clarity.
 * Primary Inputs: Profile selector
 * Primary Outputs: pedagogical-explanation-profile declaration
 * Upstream Dependencies: profile-helpers
 * Downstream Dependencies: profile-catalog, activation-policy
 * Invariants: Keeps explanatory structure explicit without forcing full academic style.
 * Failure Modes: None
 * Audit Events: pedagogical_explanation_profile_selected
 * Notes: Suitable for explanatory and instructional prompts.
 */
import { defineExecutionProfile } from "./profile-helpers";

export const pedagogicalExplanationProfile = defineExecutionProfile({
  id: "pedagogical-explanation-profile",
  label: "Pedagogical Explanation",
  purpose: "Explain clearly, progressively and with educational scaffolding.",
  defaultDepth: "standard",
  memoryPolicy: "light",
  retrievalPolicy: "light",
  reflectionPolicy: "light",
  validationPolicy: "standard",
  proactivityPolicy: "medium",
  humanizationPolicy: "balanced",
  preferredFormat: "sectioned-text",
  layerIntensities: {
    "response-planning": "heavy",
    preparatory: "medium",
    structure: "heavy",
    "delivery-profile": "delivery-rich",
    "linguistic-humanizer": "delivery-rich",
  },
  specialConstraints: ["favor_incremental_clarity"],
  suggestedFallback: "teaching-guidance-profile",
  tags: ["teaching", "explanation", "didactic"],
});
