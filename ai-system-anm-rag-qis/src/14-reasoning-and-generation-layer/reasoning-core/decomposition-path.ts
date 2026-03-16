import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function buildDecompositionPath(state: ProcessingState): string[] {
  return [
    "Identificar objetivo da pergunta.",
    "Selecionar evidencias relevantes.",
    "Responder com status epistemico.",
    ...(state.complexityProfile.score >= 0.65 ? ["Adicionar implicacoes e cenario de risco."] : []),
  ];
}
