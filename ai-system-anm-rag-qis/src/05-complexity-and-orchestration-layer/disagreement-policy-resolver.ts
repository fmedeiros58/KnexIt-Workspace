/**
 * @file disagreement-policy-resolver.ts
 * @description Resolve politica de discordancia proporcional por tipo cognitivo.
 * @layer 05-complexity-and-orchestration-layer
 * @purpose Regular contraponto sem submissao automatica e sem oposicao gratuita.
 * @inputs TaskNatureState e sinais conversacionais.
 * @outputs Politica de discordancia.
 * @dependsOn task-nature-state.
 * @usedBy dialectical-mode-selector e validadores dialogicos.
 * @invariants A politica nao obriga discordancia fora de contexto.
 * @notes Mantem a decisao auditavel no eixo de orquestracao.
 */
import type { TaskNatureState } from "../bridges/contracts/task-nature-state";

export interface DisagreementPolicy {
  allowCounterposition: boolean;
  requireCounterposition: boolean;
  maxIntensity: "low" | "medium" | "high";
  reasons: string[];
}

export function resolveDisagreementPolicy(taskNature: TaskNatureState | null | undefined): DisagreementPolicy {
  const requireCounterposition = taskNature?.selectedTaskType === "dialectical_counterargument";
  return {
    allowCounterposition: Boolean(requireCounterposition || taskNature?.requiresCounterposition),
    requireCounterposition,
    maxIntensity: requireCounterposition ? "high" : "medium",
    reasons: taskNature ? [`task_type:${taskNature.selectedTaskType}`] : ["task_nature_missing"],
  };
}

