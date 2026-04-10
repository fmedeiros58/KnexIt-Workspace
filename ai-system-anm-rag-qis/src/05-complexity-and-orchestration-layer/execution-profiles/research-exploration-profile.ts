/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: execution-profiles/research-exploration-profile
 * Responsibility: Define a regime for exploratory research and evidence gathering.
 * Primary Inputs: Profile selector
 * Primary Outputs: research-exploration-profile declaration
 * Upstream Dependencies: profile-helpers
 * Downstream Dependencies: profile-catalog, activation-policy
 * Invariants: Research exploration keeps retrieval and epistemic integration strong.
 * Failure Modes: None
 * Audit Events: research_exploration_profile_selected
 * Notes: Appropriate for open-ended exploration with explicit uncertainty handling.
 */
import { defineExecutionProfile } from "./profile-helpers";

export const researchExplorationProfile = defineExecutionProfile({
  id: "research-exploration-profile",
  label: "Research Exploration",
  purpose: "Explore topics with evidence seeking, uncertainty handling and synthesis.",
  defaultDepth: "deep",
  memoryPolicy: "light",
  retrievalPolicy: "heavy",
  reflectionPolicy: "standard",
  validationPolicy: "standard",
  proactivityPolicy: "medium",
  humanizationPolicy: "minimal",
  preferredFormat: "research-notes",
  layerIntensities: {
    knowledge: "retrieval-heavy",
    quantum: "medium",
    reflective: "medium",
    "epistemic-integration": "epistemic-heavy",
    validation: "medium",
  },
  specialConstraints: ["surface_uncertainty", "preserve_source_trace"],
  suggestedFallback: "retrieval-augmented-profile",
  tags: ["research", "exploration", "evidence"],
});
