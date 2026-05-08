/**
 * @file open-exploration-profile.ts
 * @description Define um perfil para exploracao aberta de hipoteses e possibilidades.
 * @layer 05-complexity-and-orchestration-layer
 * @purpose Permitir abertura cognitiva sem perder criterios de sintese e validacao.
 * @inputs Profile selector e TaskNatureState.
 * @outputs Declaracao open-exploration-profile.
 * @dependsOn profile-helpers.
 * @usedBy profile-catalog, activation-policy e operadores reflexivos.
 * @invariants Exploracao nao deve fingir conclusao quando a tarefa pede possibilidades.
 * @notes Reaproveita a descida inteira com intensidade reflexiva moderada.
 */
import { defineExecutionProfile } from "./profile-helpers";

export const openExplorationProfile = defineExecutionProfile({
  id: "open-exploration-profile",
  label: "Open Exploration",
  purpose: "Explore alternatives and hypotheses while keeping synthesis pressure.",
  defaultDepth: "standard",
  memoryPolicy: "light",
  retrievalPolicy: "light",
  reflectionPolicy: "standard",
  validationPolicy: "standard",
  proactivityPolicy: "medium",
  humanizationPolicy: "balanced",
  preferredFormat: "exploratory-synthesis",
  layerIntensities: {
    quantum: "medium",
    reflective: "medium",
    inferential: "medium",
    "epistemic-integration": "medium",
    validation: "medium",
  },
  specialConstraints: ["keep_hypotheses_distinct", "avoid_false_closure"],
  suggestedFallback: "research-exploration-profile",
  tags: ["exploration", "hypotheses", "synthesis"],
});

