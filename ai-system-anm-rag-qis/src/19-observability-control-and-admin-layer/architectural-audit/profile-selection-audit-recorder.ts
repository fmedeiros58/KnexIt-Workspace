/**
 * @file profile-selection-audit-recorder.ts
 * @description Resume selecao de perfil cognitivo para auditoria.
 * @layer 19-observability-control-and-admin-layer
 * @purpose Evidenciar perfil principal, secundarios, pesos e sinais dominantes.
 * @inputs ProcessingState com ProfileSelectionResult.
 * @outputs Objeto serializavel de auditoria.
 * @dependsOn bridges/contracts/processing-state.
 * @usedBy pipeline-audit-report-builder.
 * @invariants Nao deve alterar pesos nem reordenar perfis.
 * @notes Complementa o coletor legado profile-selection-audit.
 */
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function buildProfileSelectionAuditRecord(state: ProcessingState): Record<string, unknown> {
  const selection = state.profileSelectionResult;
  return {
    primaryProfileId: selection?.primaryProfileId || "none",
    selectedProfileIds: selection?.selectedProfileIds || [],
    weights: selection?.weights || {},
    dominantSignals: selection?.dominantSignals || [],
    reasons: selection?.reasons || [],
  };
}

