/**
 * @file retrieval-grounded-analysis-profile.ts
 * @description Define um perfil para analise que precisa de evidencia recuperada.
 * @layer 05-complexity-and-orchestration-layer
 * @purpose Diferenciar grounding por retrieval de analise tecnica puramente local.
 * @inputs Profile selector e TaskNatureState.
 * @outputs Declaracao retrieval-grounded-analysis-profile.
 * @dependsOn profile-helpers.
 * @usedBy profile-catalog, activation-policy e validadores epistemicos.
 * @invariants Claims verificaveis devem ser alinhados com evidencia quando retrieval for exigido.
 * @notes Complementa o perfil legado retrieval-augmented-profile com nome cognitivo explicito.
 */
import { defineExecutionProfile } from "./profile-helpers";

export const retrievalGroundedAnalysisProfile = defineExecutionProfile({
  id: "retrieval-grounded-analysis-profile",
  label: "Retrieval Grounded Analysis",
  purpose: "Analyze with evidence ranking, contradiction checks and grounded validation.",
  defaultDepth: "deep",
  memoryPolicy: "light",
  retrievalPolicy: "heavy",
  reflectionPolicy: "standard",
  validationPolicy: "heavy",
  proactivityPolicy: "low",
  humanizationPolicy: "minimal",
  preferredFormat: "grounded-analysis",
  layerIntensities: {
    knowledge: "retrieval-heavy",
    quantum: "medium",
    reflective: "medium",
    "epistemic-integration": "epistemic-heavy",
    validation: "heavy",
  },
  specialConstraints: ["ground_claims_in_retrieval", "rank_evidence", "check_contradictions"],
  suggestedFallback: "retrieval-augmented-profile",
  tags: ["retrieval", "grounded", "analysis"],
});

