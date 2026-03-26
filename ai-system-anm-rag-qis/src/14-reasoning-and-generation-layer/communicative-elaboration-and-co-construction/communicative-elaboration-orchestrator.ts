/**
 * Responsabilidade do arquivo:
 * - Orquestrar extracao, decomposicao, tensoes, hipoteses e refinamento.
 * - Produzir saida comunicativo-elaborativa unica para a rodada atual.
 * - Preservar execucao deterministica e de baixo risco de regressao.
 */
import type {
  CommunicativeElaborationInput,
  CommunicativeElaborationOutput,
} from "./communicative-elaboration.types";
import { extractIdeaSeed } from "./idea-seed-extractor";
import { decomposeConcepts } from "./concept-decomposer";
import { buildDialogicalTensions } from "./dialogical-tension-engine";
import { expandHypotheses } from "./hypothesis-expander";
import { buildCoConstructionPlan } from "./co-construction-planner";
import { runRefinementLoop } from "./refinement-loop";

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function runCommunicativeElaborationOrchestrator(
  input: CommunicativeElaborationInput,
): CommunicativeElaborationOutput {
  const ideaSeed = extractIdeaSeed(input);
  const decomposition = decomposeConcepts(ideaSeed);
  const tensions = buildDialogicalTensions(ideaSeed, decomposition);
  const hypothesisBranches = expandHypotheses(ideaSeed, tensions);
  const coConstructionPlan = buildCoConstructionPlan(ideaSeed, decomposition, tensions);
  const refinement = runRefinementLoop(coConstructionPlan, hypothesisBranches);

  const confidence = clamp01(
    (ideaSeed.confidence * 0.36) +
      (input.grounding ? input.grounding.confidence * 0.28 : 0.16) +
      (Math.max(0, 1 - (refinement.unresolvedPoints.length * 0.18)) * 0.36),
  );

  return {
    ideaSeed,
    decomposition,
    tensions,
    hypothesisBranches,
    coConstructionPlan,
    refinement,
    confidence,
  };
}

