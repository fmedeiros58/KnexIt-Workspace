/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: execution-profiles/profile-priority-rules
 * Responsibility: Define stable priority rules for execution profile selection.
 * Primary Inputs: Selected profile ids and risk context.
 * Primary Outputs: Ordered profile ids.
 * Upstream Dependencies: none
 * Downstream Dependencies: profile-selector, profile-composer
 * Invariants: Higher-caution and stronger constraint profiles must outrank lighter conversational ones.
 * Failure Modes: Unknown profile ids retain insertion order.
 * Audit Events: profile_priority_applied
 * Notes: The rules keep profile composition deterministic.
 */
const PROFILE_PRIORITY_ORDER = [
  "high-caution-validation-profile",
  "closed-constraint-deduction-profile",
  "constraint-heavy-instruction-profile",
  "dialectical-counterargument-profile",
  "architecture-audit-profile",
  "technical-implementation-profile",
  "technical-analysis-profile",
  "debug-correction-profile",
  "retrieval-grounded-analysis-profile",
  "retrieval-augmented-profile",
  "research-exploration-profile",
  "academic-normalization-profile",
  "decision-support-profile",
  "reflective-comparison-profile",
  "procedural-instruction-profile",
  "short-deterministic-reasoning-profile",
  "open-exploration-profile",
  "memory-intensive-profile",
  "multilingual-alignment-profile",
  "teaching-guidance-profile",
  "pedagogical-explanation-profile",
  "writing-composition-profile",
  "summary-synthesis-profile",
  "conversational-deep-profile",
  "conversational-light-profile",
  "greeting-profile",
] as const;

export function sortProfileIdsByPriority(profileIds: string[]): string[] {
  const rank = new Map<string, number>(PROFILE_PRIORITY_ORDER.map((profileId, index) => [profileId, index]));
  return [...new Set(profileIds)].sort((left, right) => (rank.get(left) ?? 999) - (rank.get(right) ?? 999));
}
