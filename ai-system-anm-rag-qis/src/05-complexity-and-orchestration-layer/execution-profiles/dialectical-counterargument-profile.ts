/**
 * @file dialectical-counterargument-profile.ts
 * @description Define um perfil para contraponto, objecao e teste proporcional de teses.
 * @layer 05-complexity-and-orchestration-layer
 * @purpose Evitar submissao automatica sem cair em contrarianismo artificial.
 * @inputs Profile selector e TaskNatureState.
 * @outputs Declaracao dialectical-counterargument-profile.
 * @dependsOn profile-helpers.
 * @usedBy profile-catalog, activation-policy e validadores dialogicos.
 * @invariants Contraponto deve ser calibrado e nao substituir validacao epistemica.
 * @notes Ativa camadas reflexivas e inferenciais em modo dialogico forte.
 */
import { defineExecutionProfile } from "./profile-helpers";

export const dialecticalCounterargumentProfile = defineExecutionProfile({
  id: "dialectical-counterargument-profile",
  label: "Dialectical Counterargument",
  purpose: "Build calibrated counterarguments while preserving conversational coherence.",
  defaultDepth: "deep",
  memoryPolicy: "light",
  retrievalPolicy: "light",
  reflectionPolicy: "heavy",
  validationPolicy: "heavy",
  proactivityPolicy: "low",
  humanizationPolicy: "minimal",
  preferredFormat: "position-counterposition-balance",
  layerIntensities: {
    conversation: "dialogical-strong",
    context: "dialogical-strong",
    reflective: "heavy",
    inferential: "dialogical-strong",
    "epistemic-integration": "epistemic-heavy",
    validation: "heavy",
  },
  specialConstraints: ["calibrate_counterposition", "avoid_yes_man", "avoid_contrarian_overreach"],
  suggestedFallback: "reflective-comparison-profile",
  tags: ["dialectical", "counterargument", "dialogue"],
});

