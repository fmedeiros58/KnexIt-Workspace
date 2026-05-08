/**
 * @file inference-injection-builder.ts
 * @description Injeta inferencias consolidadas no prompt de geracao sem expor metadados internos.
 * @layer 14-reasoning-and-generation-layer
 * @purpose Levar para a geracao conclusoes inferenciais, cenarios e solver de deducao fechada quando reconhecido.
 * @inputs ProcessingState com inferentialMap e executionArtifacts.inferential.
 * @outputs Bloco textual compacto para o prompt final.
 * @dependsOn ProcessingState.
 * @usedBy generation-layer-bridge.
 * @invariants A injecao deve orientar a resposta, nao revelar estruturas internas do pipeline.
 * @notes O solver de deducao fechada entra como dica semantica para reduzir dependencia de obediencia probabilistica do LLM.
 */
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function buildInferenceInjection(state: ProcessingState): string {
  const implications = state.inferentialMap.implications.slice(0, 4).join(" | ");
  const scenarios = state.inferentialMap.scenarios.slice(0, 3).join(" | ");
  const closedConstraintAction =
    state.executionArtifacts.inferential?.closedConstraintSolver?.recognized
      ? state.executionArtifacts.inferential.closedConstraintSolver.action
      : "";
  return [
    `Inferencias: ${implications || "(vazio)"}`,
    `Cenarios: ${scenarios || "(vazio)"}`,
    closedConstraintAction ? `Deducao fechada resolvida: ${closedConstraintAction}` : "",
  ].filter(Boolean).join("; ");
}
