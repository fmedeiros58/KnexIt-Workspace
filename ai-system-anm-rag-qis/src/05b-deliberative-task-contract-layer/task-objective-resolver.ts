/**
 * @file task-objective-resolver.ts
 * @description Resolve o objetivo operacional da tarefa para o TaskContract.
 * @layer 05b-deliberative-task-contract-layer
 * @purpose Transformar o pedido bruto em objetivo curto e revisavel.
 * @inputs Texto normalizado e tipo cognitivo selecionado.
 * @outputs Objetivo textual do contrato.
 * @dependsOn cognitive-task-type.
 * @usedBy task-contract-builder.
 * @invariants O objetivo deve descrever o trabalho, nao antecipar uma resposta final.
 * @notes Mantem linguagem curta para auditoria.
 */
import type { CognitiveTaskType } from "../bridges/contracts/cognitive-task-type";

export function resolveTaskObjective(text: string, taskType: CognitiveTaskType): string {
  const trimmed = `${text || ""}`.replace(/\s+/g, " ").trim();
  const prefixByType: Record<CognitiveTaskType, string> = {
    greeting_light: "Responder socialmente de forma curta",
    conversational_light: "Manter conversa leve e coerente",
    pedagogical_explanation: "Explicar o tema com progressao didatica",
    technical_analysis: "Analisar tecnicamente o problema",
    dialectical_counterargument: "Construir contraponto proporcional",
    closed_constraint_deduction: "Resolver o problema fechado respeitando restricoes",
    short_deterministic_reasoning: "Responder com raciocinio curto e deterministico",
    procedural_instruction: "Fornecer procedimento acionavel",
    retrieval_grounded_analysis: "Analisar com apoio em evidencia recuperada",
    debug_and_correction: "Identificar causa e corrigir o problema",
    academic_normalization: "Normalizar conteudo em padrao academico",
    reflective_comparison: "Comparar alternativas ou perspectivas",
    decision_between_alternatives: "Decidir entre alternativas com criterio explicito",
    open_exploration: "Explorar hipoteses e possibilidades",
    structured_synthesis: "Sintetizar e organizar informacao",
  };

  return `${prefixByType[taskType]}: ${trimmed.slice(0, 220)}`;
}

