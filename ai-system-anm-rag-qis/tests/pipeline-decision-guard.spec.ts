/**
 * Responsabilidade do arquivo:
 * - Evitar escalonamento indevido para rota factual/web em comandos tecnicos genericos.
 * - Preservar escalonamento quando houver pedido factual realmente verificavel.
 */
import { applyPipelineDecisionGuard } from "../src/00-myelinated-pipeline-core/pipeline-decision-guard";
import { createInitialProcessingState } from "../src/bridges/contracts/processing-state";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const technical = createInitialProcessingState("verifique os normalizer");
technical.executionPlan.selectedRoute = "minimum";
const technicalDecision = applyPipelineDecisionGuard(technical, "pre_branch");
assert(
  technicalDecision.routeFloor === "inferential",
  "non-greeting prompts should default to deep inferential route",
);
assert(!technicalDecision.requiresWeb, "generic technical prompt should not require web");

const factual = createInitialProcessingState("verifique com fontes quem e o presidente atual do brasil");
factual.executionPlan.selectedRoute = "minimum";
const factualDecision = applyPipelineDecisionGuard(factual, "pre_branch");
assert(
  factualDecision.routeFloor === "inferential",
  "factual verifiable prompt should be routed to deep inferential pipeline",
);
assert(factualDecision.requiresWeb, "factual verifiable prompt should require web");
