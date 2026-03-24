/**
 * Responsabilidade do arquivo:
 * - Garantir que comandos tecnicos curtos nao sejam escalados indevidamente.
 * - Preservar escalonamento inferencial em pergunta tecnica detalhada.
 */
import { runInputPreRouteScan } from "../src/01-input-layer/input-pre-route-scan";
import { selectPipelineRoute } from "../src/00-myelinated-pipeline-core/pipeline-route-selector";
import { createInitialProcessingState } from "../src/bridges/contracts/processing-state";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const shortTechnical = runInputPreRouteScan(createInitialProcessingState("verifique os normalizer"));
assert(selectPipelineRoute(shortTechnical) === "minimum", "short technical imperative should route to minimum");

const detailedTechnical = runInputPreRouteScan(
  createInitialProcessingState("como corrigir erro de normalizer no parser de entrada?"),
);
assert(selectPipelineRoute(detailedTechnical) === "inferential", "detailed technical question should route to inferential");
