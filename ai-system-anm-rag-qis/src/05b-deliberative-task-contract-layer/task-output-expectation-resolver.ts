/**
 * @file task-output-expectation-resolver.ts
 * @description Resolve formato e regime de entrega esperados para a tarefa.
 * @layer 05b-deliberative-task-contract-layer
 * @purpose Alinhar resposta esperada ao tipo cognitivo antes da geracao.
 * @inputs TaskNatureState e sinais de perfil.
 * @outputs Formato esperado, profundidade e regime de entrega.
 * @dependsOn task-contract, task-nature-state.
 * @usedBy task-contract-builder e validadores de formato.
 * @invariants O formato esperado deve modular a resposta, nao fabricar conteudo.
 * @notes O mapeamento e explicito para facilitar revisao humana.
 */
import type { TaskDepthExpectation, TaskDeliveryRegime } from "../bridges/contracts/task-contract";
import type { TaskNatureState } from "../bridges/contracts/task-nature-state";

export interface TaskOutputExpectation {
  expectedOutputFormat: string[];
  depthExpectation: TaskDepthExpectation;
  deliveryRegime: TaskDeliveryRegime;
}

export function resolveTaskOutputExpectation(taskNature: TaskNatureState): TaskOutputExpectation {
  switch (taskNature.selectedTaskType) {
    case "greeting_light":
    case "conversational_light":
      return { expectedOutputFormat: ["concise-paragraph"], depthExpectation: "shallow", deliveryRegime: "direct" };
    case "closed_constraint_deduction":
    case "short_deterministic_reasoning":
      return { expectedOutputFormat: taskNature.expectedResponseShape, depthExpectation: "standard", deliveryRegime: "direct" };
    case "procedural_instruction":
      return { expectedOutputFormat: ["ordered-steps"], depthExpectation: "standard", deliveryRegime: "stepwise" };
    case "retrieval_grounded_analysis":
      return { expectedOutputFormat: ["grounded-analysis"], depthExpectation: "deep", deliveryRegime: "grounded" };
    case "dialectical_counterargument":
      return { expectedOutputFormat: ["position-counterposition-balance"], depthExpectation: "deep", deliveryRegime: "dialogical" };
    default:
      return { expectedOutputFormat: taskNature.expectedResponseShape, depthExpectation: "standard", deliveryRegime: "structured" };
  }
}

