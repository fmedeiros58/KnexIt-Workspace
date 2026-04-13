/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: execution-profiles/conversational-deep-profile
 * Responsibility: Define a richer conversational regime for nuanced dialogue.
 * Primary Inputs: Profile selector
 * Primary Outputs: conversational-deep-profile declaration
 * Upstream Dependencies: profile-helpers
 * Downstream Dependencies: profile-catalog, activation-policy
 * Invariants: Maintains conversational tone while enabling reflection and inference.
 * Failure Modes: None
 * Audit Events: conversational_deep_profile_selected
 * Notes: Useful when user intent is conversational but depth is required.
 */
import { defineExecutionProfile } from "./profile-helpers";

export const conversationalDeepProfile = defineExecutionProfile({
  id: "conversational-deep-profile",
  label: "Conversational Deep",
  purpose: "Support nuanced conversation with reflective and inferential depth.",
  defaultDepth: "deep",
  memoryPolicy: "standard",
  retrievalPolicy: "light",
  reflectionPolicy: "standard",
  validationPolicy: "standard",
  proactivityPolicy: "medium",
  humanizationPolicy: "rich",
  preferredFormat: "plain-text",
  layerIntensities: {
    memory: "memory-heavy",
    reflective: "medium",
    inferential: "heavy",
    "response-behavior": "heavy",
    "linguistic-humanizer": "delivery-rich",
  },
  specialConstraints: ["preserve_dialogic_continuity"],
  suggestedFallback: "conversational-light-profile",
  tags: ["chat", "deep", "dialogue"],
});
