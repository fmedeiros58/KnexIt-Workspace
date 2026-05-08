/**
 * @file transition-integrity-checker.ts
 * @description Verifica coerencia entre contrato adaptativo e execucao observada.
 * @layer 19-observability-control-and-admin-layer
 * @purpose Detectar ausencia de contrato, perfil ou matriz durante a descida.
 * @inputs ProcessingState.
 * @outputs Resultado de integridade de transicao.
 * @dependsOn bridges/contracts/processing-state.
 * @usedBy pipeline-audit-report-builder.
 * @invariants O checker observa a transicao; nao executa fallback.
 * @notes Falhas aqui indicam baixa auditabilidade ou quebra de integracao real.
 */
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function checkTransitionIntegrity(state: ProcessingState): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!state.taskNatureState) issues.push("task_nature_state_missing");
  if (!state.taskContract) issues.push("task_contract_missing");
  if (!state.profileSelectionResult) issues.push("profile_selection_missing");
  if (!state.adaptivePipelineContract) issues.push("adaptive_pipeline_contract_missing");
  if (!state.adaptivePipelineContract?.layerActivations) issues.push("layer_activation_map_missing");
  return {
    ok: issues.length === 0,
    issues,
  };
}

