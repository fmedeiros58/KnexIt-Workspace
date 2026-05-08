/**
 * @file adaptive-routing-policy.ts
 * @description Define leituras auxiliares de politica adaptativa sem criar rotas externas.
 * @layer 05-complexity-and-orchestration-layer
 * @purpose Expor resumo auditavel da descida adaptativa para camadas consumidoras.
 * @inputs AdaptivePipelineContract opcional.
 * @outputs Resumo de politica adaptativa.
 * @dependsOn bridges/contracts/adaptive-pipeline-contract.
 * @usedBy observabilidade, validacao e futuras integracoes.
 * @invariants A politica descreve intensidade; ela nao substitui pipeline-flow-descending.
 * @notes Mantem a logica de pipeline descendente integral.
 */
import type { AdaptivePipelineContract } from "../bridges/contracts/adaptive-pipeline-contract";

export interface AdaptiveRoutingPolicySummary {
  primaryProfileId: string;
  selectedTaskType: string;
  retrievalHeavy: boolean;
  validationHeavy: boolean;
  dialogicalStrong: boolean;
}

export function summarizeAdaptiveRoutingPolicy(
  contract: AdaptivePipelineContract | null | undefined,
): AdaptiveRoutingPolicySummary {
  return {
    primaryProfileId: contract?.selectedProfiles.primaryProfileId || "none",
    selectedTaskType: contract?.taskNatureState?.selectedTaskType || "unknown",
    retrievalHeavy: contract?.retrievalPolicy === "heavy",
    validationHeavy: contract?.validationPolicy === "heavy",
    dialogicalStrong: contract?.taskContract?.needsCounterposition || false,
  };
}

