/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: execution-profiles/conversational-light-profile
 * Responsibility: Define a low-cost conversational regime for simple non-greeting chat.
 * Primary Inputs: Profile selector
 * Primary Outputs: conversational-light-profile declaration
 * Upstream Dependencies: profile-helpers
 * Downstream Dependencies: profile-catalog, activation-policy
 * Invariants: Keeps the tree intact while reducing heavy epistemic stages.
 * Failure Modes: None
 * Audit Events: conversational_light_profile_selected
 * Notes: Best used for direct, low-risk answers.
 */
import { defineExecutionProfile } from "./profile-helpers";

export const conversationalLightProfile = defineExecutionProfile({
  id: "conversational-light-profile",
  label: "Conversational Light",
  purpose: "Handle simple conversations with low epistemic burden and compact delivery.",
  defaultDepth: "shallow",
  memoryPolicy: "light",
  retrievalPolicy: "light",
  reflectionPolicy: "light",
  validationPolicy: "light",
  proactivityPolicy: "low",
  humanizationPolicy: "balanced",
  preferredFormat: "plain-text",
  layerIntensities: {
    knowledge: "noop-intelligent",
    quantum: "noop-intelligent",
    reflective: "noop-intelligent",
    inferential: "light",
    "academic-normalization": "noop-intelligent",
    "delivery-profile": "delivery-light",
  },
  specialConstraints: ["preserve_conversational_flow"],
  suggestedFallback: "greeting-profile",
  tags: ["chat", "light", "conversational"],
});
