/**
 * @file cognitive-task-type.ts
 * @description Define os tipos canonicos de natureza cognitiva de tarefa usados pelo pipeline.
 * @layer bridges/contracts
 * @purpose Separar a natureza cognitiva da tarefa da intencao conversacional simples.
 * @inputs Sinais de classificacao vindos da orquestracao e operadores de conversa.
 * @outputs Uniao CognitiveTaskType e utilitarios de validacao.
 * @dependsOn Nenhuma dependencia externa.
 * @usedBy task-nature-state, task-contract, seletores de perfil, validadores e auditoria.
 * @invariants A lista deve representar regimes cognitivos, nao intents conversacionais.
 * @notes Novas classes devem preservar compatibilidade com o contrato adaptativo descendente.
 */
export const COGNITIVE_TASK_TYPES = [
  "greeting_light",
  "conversational_light",
  "pedagogical_explanation",
  "technical_analysis",
  "dialectical_counterargument",
  "closed_constraint_deduction",
  "short_deterministic_reasoning",
  "procedural_instruction",
  "retrieval_grounded_analysis",
  "debug_and_correction",
  "academic_normalization",
  "reflective_comparison",
  "decision_between_alternatives",
  "open_exploration",
  "structured_synthesis",
] as const;

export type CognitiveTaskType = typeof COGNITIVE_TASK_TYPES[number];

export function isCognitiveTaskType(value: string | null | undefined): value is CognitiveTaskType {
  return Boolean(value && (COGNITIVE_TASK_TYPES as readonly string[]).includes(value));
}

