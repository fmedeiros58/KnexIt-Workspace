/**
 * Responsabilidade do arquivo:
 * - Resolver lista de familias ativas para a rodada atual do pipeline.
 * - Reaproveitar registry + activation policy sem duplicar gates nas camadas.
 * - Expor IDs compactos para executionArtifacts/observability.
 */
import type { ProcessingState } from "../../bridges/contracts/processing-state";
import { FAMILY_REGISTRY } from "./family-registry";
import { isFamilyActive } from "./family-activation-policy";

export function resolveActiveFamilies(state: ProcessingState) {
  return FAMILY_REGISTRY.filter((family) => isFamilyActive(state, family));
}

export function resolveActiveFamilyIds(state: ProcessingState) {
  return resolveActiveFamilies(state).map((item) => item.id);
}

