/**
 * @file task-regime-decider.ts
 * @description Resolve um regime operacional simples a partir da natureza cognitiva da tarefa.
 * @layer 05-complexity-and-orchestration-layer
 * @purpose Fornecer uma leitura compacta para politicas adaptativas e auditoria.
 * @inputs TaskNatureState.
 * @outputs Identificador de regime cognitivo.
 * @dependsOn bridges/contracts/task-nature-state.
 * @usedBy testes, auditoria e futuras politicas de composicao.
 * @invariants O regime e descritivo; nao redireciona o pipeline sozinho.
 * @notes Mantido fora do profile selector para preservar separacao conceitual.
 */
import type { TaskNatureState } from "../bridges/contracts/task-nature-state";

export type TaskRegime =
  | "light_dialogue"
  | "explain"
  | "analyze"
  | "deduce"
  | "debug"
  | "ground"
  | "argue"
  | "synthesize";

export function decideTaskRegime(taskNature: TaskNatureState): TaskRegime {
  switch (taskNature.selectedTaskType) {
    case "greeting_light":
    case "conversational_light":
      return "light_dialogue";
    case "pedagogical_explanation":
    case "procedural_instruction":
      return "explain";
    case "technical_analysis":
    case "reflective_comparison":
    case "decision_between_alternatives":
      return "analyze";
    case "closed_constraint_deduction":
    case "short_deterministic_reasoning":
      return "deduce";
    case "debug_and_correction":
      return "debug";
    case "retrieval_grounded_analysis":
      return "ground";
    case "dialectical_counterargument":
      return "argue";
    default:
      return "synthesize";
  }
}

