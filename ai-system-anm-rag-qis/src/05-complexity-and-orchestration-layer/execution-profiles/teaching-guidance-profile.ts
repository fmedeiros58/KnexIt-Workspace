/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: execution-profiles/teaching-guidance-profile
 * Responsibility: Define a guidance-oriented teaching regime focused on steps and scaffolding.
 * Primary Inputs: Profile selector
 * Primary Outputs: teaching-guidance-profile declaration
 * Upstream Dependencies: profile-helpers
 * Downstream Dependencies: profile-catalog, activation-policy
 * Invariants: Teaching guidance keeps planning and structure strong.
 * Failure Modes: None
 * Audit Events: teaching_guidance_profile_selected
 * Notes: Slightly more procedural than pedagogical-explanation-profile.
 */
import { defineExecutionProfile } from "./profile-helpers";

export const teachingGuidanceProfile = defineExecutionProfile({
  id: "teaching-guidance-profile",
  label: "Teaching Guidance",
  purpose: "Guide the user through understanding or execution with stepwise support.",
  defaultDepth: "standard",
  memoryPolicy: "light",
  retrievalPolicy: "light",
  reflectionPolicy: "light",
  validationPolicy: "standard",
  proactivityPolicy: "medium",
  humanizationPolicy: "balanced",
  preferredFormat: "stepwise-text",
  layerIntensities: {
    preparatory: "medium",
    "response-planning": "heavy",
    structure: "heavy",
    "proactivity-gate": "medium",
    "delivery-profile": "delivery-rich",
  },
  specialConstraints: ["favor_actionable_steps"],
  suggestedFallback: "pedagogical-explanation-profile",
  tags: ["teaching", "guidance", "stepwise"],
});
