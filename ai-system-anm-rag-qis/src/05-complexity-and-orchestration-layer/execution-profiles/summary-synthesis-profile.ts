/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: execution-profiles/summary-synthesis-profile
 * Responsibility: Define a regime for summarization and synthesis.
 * Primary Inputs: Profile selector
 * Primary Outputs: summary-synthesis-profile declaration
 * Upstream Dependencies: profile-helpers
 * Downstream Dependencies: profile-catalog, activation-policy
 * Invariants: Summarization reduces depth while keeping structure and calibration explicit.
 * Failure Modes: None
 * Audit Events: summary_synthesis_profile_selected
 * Notes: Appropriate for compression and synthesis requests.
 */
import { defineExecutionProfile } from "./profile-helpers";

export const summarySynthesisProfile = defineExecutionProfile({
  id: "summary-synthesis-profile",
  label: "Summary Synthesis",
  purpose: "Compress information into a clear, structured synthesis.",
  defaultDepth: "shallow",
  memoryPolicy: "light",
  retrievalPolicy: "light",
  reflectionPolicy: "light",
  validationPolicy: "standard",
  proactivityPolicy: "low",
  humanizationPolicy: "balanced",
  preferredFormat: "summary-text",
  layerIntensities: {
    inferential: "light",
    structure: "heavy",
    "response-calibration": "delivery-light",
  },
  specialConstraints: ["prefer_information_compression"],
  suggestedFallback: "conversational-light-profile",
  tags: ["summary", "synthesis", "compression"],
});
