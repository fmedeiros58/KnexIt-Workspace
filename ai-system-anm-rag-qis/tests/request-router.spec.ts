/**
 * Responsabilidade do arquivo:
 * - Garantir roteamento tecnico curto para rota inferencial.
 * - Manter roteamento inferencial para questoes tecnicas com contexto suficiente.
 */
import { routeRequest } from "../src/05-complexity-and-orchestration-layer/request-router";
import { createInitialProcessingState } from "../src/bridges/contracts/processing-state";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const shortTechnical = createInitialProcessingState("verifique os normalizer");
shortTechnical.inputSignals.intent = "technical";
shortTechnical.preRouteSignals.quickIntent = "technical";
assert(routeRequest(shortTechnical) === "inferential", "short technical imperative should use inferential route");

const detailedTechnical = createInitialProcessingState("como corrigir erro de normalizer no parser de entrada?");
detailedTechnical.inputSignals.intent = "technical";
detailedTechnical.preRouteSignals.quickIntent = "technical";
assert(routeRequest(detailedTechnical) === "inferential", "detailed technical question should use inferential route");
