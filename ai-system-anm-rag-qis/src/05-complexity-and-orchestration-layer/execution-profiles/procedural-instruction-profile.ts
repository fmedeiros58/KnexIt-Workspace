/**
 * @file procedural-instruction-profile.ts
 * @description Define um perfil para instrucoes procedimentais executaveis.
 * @layer 05-complexity-and-orchestration-layer
 * @purpose Organizar passos, pre-condicoes e alertas sem transformar tudo em ensaio.
 * @inputs Profile selector e TaskNatureState.
 * @outputs Declaracao procedural-instruction-profile.
 * @dependsOn profile-helpers.
 * @usedBy profile-catalog, activation-policy e validadores de formato.
 * @invariants Procedimentos devem ser acionaveis e respeitar restricoes do usuario.
 * @notes Eleva planejamento e validacao estrutural.
 */
import { defineExecutionProfile } from "./profile-helpers";

export const proceduralInstructionProfile = defineExecutionProfile({
  id: "procedural-instruction-profile",
  label: "Procedural Instruction",
  purpose: "Provide actionable steps with clear constraints and sequencing.",
  defaultDepth: "standard",
  memoryPolicy: "light",
  retrievalPolicy: "light",
  reflectionPolicy: "light",
  validationPolicy: "standard",
  proactivityPolicy: "low",
  humanizationPolicy: "minimal",
  preferredFormat: "ordered-steps",
  layerIntensities: {
    "response-planning": "heavy",
    preparatory: "medium",
    inferential: "medium",
    structure: "heavy",
    validation: "medium",
  },
  specialConstraints: ["produce_actionable_steps", "preserve_sequence"],
  suggestedFallback: "teaching-guidance-profile",
  tags: ["procedure", "instruction", "steps"],
});

