/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: execution-profiles/writing-composition-profile
 * Responsibility: Define a regime for writing, drafting and composition tasks.
 * Primary Inputs: Profile selector
 * Primary Outputs: writing-composition-profile declaration
 * Upstream Dependencies: profile-helpers
 * Downstream Dependencies: profile-catalog, activation-policy
 * Invariants: Writing requests bias toward structure and calibrated delivery.
 * Failure Modes: None
 * Audit Events: writing_composition_profile_selected
 * Notes: This profile is for drafting output rather than repository execution.
 */
import { defineExecutionProfile } from "./profile-helpers";

export const writingCompositionProfile = defineExecutionProfile({
  id: "writing-composition-profile",
  label: "Writing Composition",
  purpose: "Support drafting and compositional writing with stronger structure and stylistic control.",
  defaultDepth: "standard",
  memoryPolicy: "light",
  retrievalPolicy: "light",
  reflectionPolicy: "light",
  validationPolicy: "standard",
  proactivityPolicy: "medium",
  humanizationPolicy: "rich",
  preferredFormat: "composed-text",
  layerIntensities: {
    "response-planning": "heavy",
    structure: "heavy",
    "response-behavior": "medium",
    "linguistic-humanizer": "delivery-rich",
    "response-calibration": "delivery-rich",
  },
  specialConstraints: ["preserve_textual_flow"],
  suggestedFallback: "summary-synthesis-profile",
  tags: ["writing", "composition", "drafting"],
});
