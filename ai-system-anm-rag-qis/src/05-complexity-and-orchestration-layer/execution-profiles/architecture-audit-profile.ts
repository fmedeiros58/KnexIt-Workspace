/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: execution-profiles/architecture-audit-profile
 * Responsibility: Define a regime for architectural audits over the descending pipeline.
 * Primary Inputs: Profile selector
 * Primary Outputs: architecture-audit-profile declaration
 * Upstream Dependencies: profile-helpers
 * Downstream Dependencies: profile-catalog, activation-policy
 * Invariants: Audit requests preserve reflection, inference, validation and observability strength.
 * Failure Modes: None
 * Audit Events: architecture_audit_profile_selected
 * Notes: Tailored for repository-wide inspection and architectural reporting.
 */
import { defineExecutionProfile } from "./profile-helpers";

export const architectureAuditProfile = defineExecutionProfile({
  id: "architecture-audit-profile",
  label: "Architecture Audit",
  purpose: "Audit system architecture, contracts, state, observability and stage contribution.",
  defaultDepth: "deep",
  memoryPolicy: "standard",
  retrievalPolicy: "standard",
  reflectionPolicy: "heavy",
  validationPolicy: "heavy",
  proactivityPolicy: "low",
  humanizationPolicy: "minimal",
  preferredFormat: "matrix-report",
  layerIntensities: {
    knowledge: "retrieval-heavy",
    reflective: "heavy",
    inferential: "heavy",
    metacognitive: "medium",
    "epistemic-integration": "epistemic-heavy",
    validation: "heavy",
    observability: "required",
  },
  specialConstraints: ["prefer_file_grounding", "prefer_contract_explication"],
  suggestedFallback: "technical-analysis-profile",
  tags: ["architecture", "audit", "repository"],
});
