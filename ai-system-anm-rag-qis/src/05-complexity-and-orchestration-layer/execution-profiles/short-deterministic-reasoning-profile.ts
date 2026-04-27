/**
 * @file short-deterministic-reasoning-profile.ts
 * @description Define um perfil para raciocinios curtos e respostas deterministicas.
 * @layer 05-complexity-and-orchestration-layer
 * @purpose Reduzir enrolacao quando a tarefa pede conclusao curta e verificavel.
 * @inputs Profile selector e TaskNatureState.
 * @outputs Declaracao short-deterministic-reasoning-profile.
 * @dependsOn profile-helpers.
 * @usedBy profile-catalog, activation-policy e validadores de formato.
 * @invariants A resposta deve ser direta, mas ainda validada contra restricoes explicitas.
 * @notes Serve como fallback leve para deducao fechada.
 */
import { defineExecutionProfile } from "./profile-helpers";

export const shortDeterministicReasoningProfile = defineExecutionProfile({
  id: "short-deterministic-reasoning-profile",
  label: "Short Deterministic Reasoning",
  purpose: "Answer short deterministic tasks with minimal but sufficient reasoning.",
  defaultDepth: "shallow",
  memoryPolicy: "disabled",
  retrievalPolicy: "disabled",
  reflectionPolicy: "light",
  validationPolicy: "standard",
  proactivityPolicy: "low",
  humanizationPolicy: "minimal",
  preferredFormat: "direct-answer",
  layerIntensities: {
    "deliberative-task-contract": "medium",
    knowledge: "noop-intelligent",
    reflective: "light",
    inferential: "medium",
    validation: "medium",
    "response-calibration": "heavy",
  },
  specialConstraints: ["prefer_direct_answer", "avoid_unnecessary_elaboration"],
  suggestedFallback: "conversational-light-profile",
  tags: ["deterministic", "short", "reasoning"],
});

