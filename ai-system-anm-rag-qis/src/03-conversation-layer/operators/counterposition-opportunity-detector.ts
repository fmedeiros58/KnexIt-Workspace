/**
 * @file counterposition-opportunity-detector.ts
 * @description Detecta oportunidade de contraponto calibrado no turno conversacional.
 * @layer 03-conversation-layer
 * @purpose Evitar tanto submissao automatica quanto contradicao gratuita.
 * @inputs Texto do usuario e classe cognitiva opcional.
 * @outputs CounterpositionOpportunity.
 * @dependsOn cognitive-task-type.
 * @usedBy politicas dialeticas e validadores de balanceamento.
 * @invariants Oportunidade de contraponto nao implica obrigacao de discordar.
 * @notes Contraponto forte so deve emergir com pedido, tese ou risco explicito.
 */
import type { CognitiveTaskType } from "../../bridges/contracts/cognitive-task-type";

export interface CounterpositionOpportunity {
  shouldCounterposition: boolean;
  intensity: "none" | "low" | "medium" | "high";
  reasons: string[];
}

export function detectCounterpositionOpportunity(
  text: string,
  taskType?: CognitiveTaskType,
): CounterpositionOpportunity {
  const reasons = [
    ...(taskType === "dialectical_counterargument" ? ["task_type_dialectical"] : []),
    ...(/\b(discorde|conteste|critique|refute|contra-?argumente)\b/i.test(text) ? ["explicit_counterposition_request"] : []),
    ...(/\b(tenho certeza|sempre|nunca|obvio|[oó]bvio)\b/i.test(text) ? ["strong_user_claim"] : []),
  ];
  const intensity = reasons.includes("explicit_counterposition_request") ? "high" : reasons.length ? "medium" : "none";
  return { shouldCounterposition: reasons.length > 0, intensity, reasons };
}

