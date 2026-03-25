/**
 * Responsabilidade do arquivo:
 * - Converter executionPlan.steps em gates reais de camadas.
 * - Evitar execucao universal quando o planejamento nao exige profundidade.
 * - Manter compatibilidade com steps canonicos e legados.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";

function hasStep(state: ProcessingState, ...candidates: string[]) {
  const steps = state.executionPlan.steps || [];
  return candidates.some((candidate) => steps.includes(candidate));
}

export function shouldRunKnowledgeLayer(state: ProcessingState) {
  return hasStep(
    state,
    "retrieval",
    "retrieval_augmented",
    "research",
    "web_search",
    "fact_check",
    "evidence_alignment",
    "retrieve_memory",
    "retrieve_knowledge",
    "merge_evidence",
    "tool:web_research",
  );
}

export function shouldRunReflectiveLayer(state: ProcessingState) {
  return hasStep(
    state,
    "reflection",
    "critical_reflection",
    "assumption_scan",
    "caveat_building",
  );
}

export function shouldRunInferentialLayer(state: ProcessingState) {
  return hasStep(
    state,
    "inference",
    "scenario_projection",
    "second_order_reasoning",
    "implication_mapping",
    "infer_implications",
    "project_scenarios",
  );
}

export function shouldRunQuantumLayer(state: ProcessingState) {
  return hasStep(
    state,
    "quantum_reasoning",
    "deep_verification",
    "high_rigor_resolution",
    "quantum_superposition",
    "hypothesis_interference",
    "truth_collapse",
  );
}
