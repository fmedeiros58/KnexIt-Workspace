/**
 * @file closed-constraint-deduction-profile.ts
 * @description Define um perfil para problemas fechados com restricoes explicitas.
 * @layer 05-complexity-and-orchestration-layer
 * @purpose Fazer o sistema resolver dedutivamente em vez de discursar genericamente.
 * @inputs Profile selector e TaskNatureState.
 * @outputs Declaracao closed-constraint-deduction-profile.
 * @dependsOn profile-helpers.
 * @usedBy profile-catalog, activation-policy e validadores de restricao.
 * @invariants Restricoes do enunciado devem ser rastreadas antes da resposta final.
 * @notes Projetado para puzzles, provas curtas e deducoes deterministicas.
 */
import { defineExecutionProfile } from "./profile-helpers";

export const closedConstraintDeductionProfile = defineExecutionProfile({
  id: "closed-constraint-deduction-profile",
  label: "Closed Constraint Deduction",
  purpose: "Solve closed problems by mapping constraints and deriving the answer.",
  defaultDepth: "standard",
  memoryPolicy: "disabled",
  retrievalPolicy: "disabled",
  reflectionPolicy: "standard",
  validationPolicy: "heavy",
  proactivityPolicy: "low",
  humanizationPolicy: "minimal",
  preferredFormat: "conclusion-first-short-proof",
  layerIntensities: {
    "deliberative-task-contract": "heavy",
    knowledge: "noop-intelligent",
    quantum: "medium",
    reflective: "medium",
    inferential: "heavy",
    validation: "heavy",
    "response-calibration": "heavy",
  },
  specialConstraints: ["respect_explicit_constraints", "answer_with_solution_not_discourse", "prefer_short_proof"],
  suggestedFallback: "short-deterministic-reasoning-profile",
  tags: ["deduction", "constraints", "closed-problem"],
});

