/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: execution-profiles/greeting-profile
 * Responsibility: Define the lightest conversational greeting operating regime.
 * Primary Inputs: Profile selector
 * Primary Outputs: greeting-profile declaration
 * Upstream Dependencies: profile-helpers
 * Downstream Dependencies: profile-catalog, activation-policy
 * Invariants: Greeting handling stays inside the descending tree with mostly noop downstream modes.
 * Failure Modes: None
 * Audit Events: greeting_profile_selected
 * Notes: This profile aggressively favors cheap downstream execution.
 */
import { defineExecutionProfile } from "./profile-helpers";

export const greetingProfile = defineExecutionProfile({
  id: "greeting-profile",
  label: "Greeting",
  purpose: "Handle greetings and low-stakes conversational openings with minimal downstream cost.",
  defaultDepth: "shallow",
  memoryPolicy: "light",
  retrievalPolicy: "disabled",
  reflectionPolicy: "disabled",
  validationPolicy: "light",
  proactivityPolicy: "low",
  humanizationPolicy: "balanced",
  preferredFormat: "plain-text",
  layerIntensities: {
    memory: "noop-intelligent",
    knowledge: "noop-intelligent",
    quantum: "noop-intelligent",
    reflective: "noop-intelligent",
    inferential: "noop-intelligent",
    "epistemic-integration": "noop-intelligent",
    "academic-normalization": "noop-intelligent",
    feedback: "noop-intelligent",
  },
  specialConstraints: ["preserve_briefness", "avoid_overprocessing"],
  suggestedFallback: "conversational-light-profile",
  tags: ["chat", "greeting", "low-cost"],
});
