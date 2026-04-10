/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: execution-profiles/retrieval-augmented-profile
 * Responsibility: Define a regime where retrieval is a first-class downstream need.
 * Primary Inputs: Profile selector
 * Primary Outputs: retrieval-augmented-profile declaration
 * Upstream Dependencies: profile-helpers
 * Downstream Dependencies: profile-catalog, activation-policy
 * Invariants: Retrieval-heavy requests keep knowledge and validation elevated.
 * Failure Modes: None
 * Audit Events: retrieval_augmented_profile_selected
 * Notes: Useful for verifiable, recent or repository-backed prompts.
 */
import { defineExecutionProfile } from "./profile-helpers";

export const retrievalAugmentedProfile = defineExecutionProfile({
  id: "retrieval-augmented-profile",
  label: "Retrieval Augmented",
  purpose: "Prioritize retrieval, evidence ranking and grounded validation.",
  defaultDepth: "deep",
  memoryPolicy: "light",
  retrievalPolicy: "heavy",
  reflectionPolicy: "light",
  validationPolicy: "heavy",
  proactivityPolicy: "low",
  humanizationPolicy: "minimal",
  preferredFormat: "grounded-text",
  layerIntensities: {
    knowledge: "retrieval-heavy",
    quantum: "medium",
    "epistemic-integration": "epistemic-heavy",
    validation: "heavy",
  },
  specialConstraints: ["prefer_grounded_claims"],
  suggestedFallback: "research-exploration-profile",
  tags: ["retrieval", "grounded", "verification"],
});
