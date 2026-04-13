/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: execution-profiles/technical-analysis-profile
 * Responsibility: Define a rigorous technical analysis regime.
 * Primary Inputs: Profile selector
 * Primary Outputs: technical-analysis-profile declaration
 * Upstream Dependencies: profile-helpers
 * Downstream Dependencies: profile-catalog, activation-policy
 * Invariants: Technical analysis preserves strong validation and inferential depth.
 * Failure Modes: None
 * Audit Events: technical_analysis_profile_selected
 * Notes: Optimized for diagnosis, architecture inspection and systems reasoning.
 */
import { defineExecutionProfile } from "./profile-helpers";

export const technicalAnalysisProfile = defineExecutionProfile({
  id: "technical-analysis-profile",
  label: "Technical Analysis",
  purpose: "Analyze technical systems, code or architecture with explicit reasoning and validation.",
  defaultDepth: "deep",
  memoryPolicy: "standard",
  retrievalPolicy: "standard",
  reflectionPolicy: "standard",
  validationPolicy: "heavy",
  proactivityPolicy: "low",
  humanizationPolicy: "minimal",
  preferredFormat: "sectioned-text",
  layerIntensities: {
    memory: "medium",
    knowledge: "retrieval-heavy",
    reflective: "heavy",
    inferential: "heavy",
    "epistemic-integration": "epistemic-heavy",
    validation: "heavy",
  },
  specialConstraints: ["prefer_explicit_tradeoffs", "avoid_handwaving"],
  suggestedFallback: "debug-correction-profile",
  tags: ["technical", "analysis", "architecture"],
});
