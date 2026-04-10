/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: execution-profiles/memory-intensive-profile
 * Responsibility: Define a regime for prompts that depend heavily on continuity or prior context.
 * Primary Inputs: Profile selector
 * Primary Outputs: memory-intensive-profile declaration
 * Upstream Dependencies: profile-helpers
 * Downstream Dependencies: profile-catalog, activation-policy
 * Invariants: Memory-heavy requests elevate context, memory and continuity-sensitive delivery.
 * Failure Modes: None
 * Audit Events: memory_intensive_profile_selected
 * Notes: Intended for follow-ups, continuity and context carry-over.
 */
import { defineExecutionProfile } from "./profile-helpers";

export const memoryIntensiveProfile = defineExecutionProfile({
  id: "memory-intensive-profile",
  label: "Memory Intensive",
  purpose: "Strengthen memory, context continuity and session-sensitive reasoning.",
  defaultDepth: "standard",
  memoryPolicy: "heavy",
  retrievalPolicy: "light",
  reflectionPolicy: "light",
  validationPolicy: "standard",
  proactivityPolicy: "medium",
  humanizationPolicy: "balanced",
  preferredFormat: "continuity-aware-text",
  layerIntensities: {
    context: "memory-heavy",
    memory: "memory-heavy",
    "response-behavior": "medium",
    "delivery-profile": "delivery-rich",
  },
  specialConstraints: ["preserve_conversation_carryover"],
  suggestedFallback: "conversational-deep-profile",
  tags: ["memory", "continuity", "session"],
});
