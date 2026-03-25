/**
 * Responsabilidade do arquivo:
 * - Resolver perfil de validacao considerando estagio progressivo.
 * - Promover perfil light para standard no estagio final.
 * - Garantir fallback seguro quando perfil nao estiver definido.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";

export type ValidationProfile = "light" | "standard" | "strict";

export function resolveValidationProfile(state: ProcessingState): ValidationProfile {
  if (state.executionArtifacts?.validationStage === "pre_presentation") {
    return state.executionPlan.validationProfile || "standard";
  }

  if (state.executionArtifacts?.validationStage === "final") {
    if (state.executionPlan.validationProfile === "light") return "standard";
    return state.executionPlan.validationProfile || "strict";
  }

  return state.executionPlan.validationProfile || "standard";
}
