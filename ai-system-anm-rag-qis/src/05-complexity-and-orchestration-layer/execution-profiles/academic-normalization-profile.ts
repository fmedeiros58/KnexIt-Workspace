/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: execution-profiles/academic-normalization-profile
 * Responsibility: Define a regime where academic normalization is a strong downstream requirement.
 * Primary Inputs: Profile selector
 * Primary Outputs: academic-normalization-profile declaration
 * Upstream Dependencies: profile-helpers
 * Downstream Dependencies: profile-catalog, activation-policy
 * Invariants: Academic output strengthens structure, validation and normalization without bypassing generation.
 * Failure Modes: None
 * Audit Events: academic_normalization_profile_selected
 * Notes: Use when citation style or formal academic surface is requested.
 */
import { defineExecutionProfile } from "./profile-helpers";

export const academicNormalizationProfile = defineExecutionProfile({
  id: "academic-normalization-profile",
  label: "Academic Normalization",
  purpose: "Increase formal structure, citation care and academic consistency.",
  defaultDepth: "deep",
  memoryPolicy: "light",
  retrievalPolicy: "standard",
  reflectionPolicy: "standard",
  validationPolicy: "heavy",
  proactivityPolicy: "low",
  humanizationPolicy: "minimal",
  preferredFormat: "academic-text",
  layerIntensities: {
    knowledge: "retrieval-heavy",
    structure: "heavy",
    "academic-normalization": "heavy",
    validation: "heavy",
    presentation: "delivery-rich",
  },
  specialConstraints: ["prefer_formal_register"],
  suggestedFallback: "research-exploration-profile",
  tags: ["academic", "formal", "citation"],
});
