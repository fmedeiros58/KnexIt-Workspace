/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: execution-profiles/multilingual-alignment-profile
 * Responsibility: Define a regime for multilingual or language-alignment-sensitive requests.
 * Primary Inputs: Profile selector
 * Primary Outputs: multilingual-alignment-profile declaration
 * Upstream Dependencies: profile-helpers
 * Downstream Dependencies: profile-catalog, activation-policy
 * Invariants: Language alignment strengthens language, structure and delivery behavior.
 * Failure Modes: None
 * Audit Events: multilingual_alignment_profile_selected
 * Notes: Keeps downstream delivery sensitive to language preservation.
 */
import { defineExecutionProfile } from "./profile-helpers";

export const multilingualAlignmentProfile = defineExecutionProfile({
  id: "multilingual-alignment-profile",
  label: "Multilingual Alignment",
  purpose: "Preserve and align language-sensitive output in multilingual contexts.",
  defaultDepth: "standard",
  memoryPolicy: "light",
  retrievalPolicy: "light",
  reflectionPolicy: "light",
  validationPolicy: "standard",
  proactivityPolicy: "low",
  humanizationPolicy: "balanced",
  preferredFormat: "language-aligned-text",
  layerIntensities: {
    language: "required",
    structure: "medium",
    "response-behavior": "medium",
    "linguistic-humanizer": "delivery-rich",
    presentation: "delivery-rich",
  },
  specialConstraints: ["preserve_user_language"],
  suggestedFallback: "conversational-light-profile",
  tags: ["multilingual", "alignment", "language"],
});
