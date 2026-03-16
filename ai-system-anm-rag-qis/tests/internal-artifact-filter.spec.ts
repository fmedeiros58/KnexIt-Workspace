/**
 * Responsabilidade do arquivo:
 * - Validar limpeza de artefatos internos no texto final de resposta.
 * - Validar extracao da ultima fala util do usuario em entrada contaminada.
 */
import { filterInternalArtifacts } from "../src/15-response-structure-engine/internal-artifact-filter";
import { extractLatestUserUtterance } from "../src/shared/utils/conversation-signals";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const noisyInput = [
  "qual o nome do governador do acre",
  "",
  "Pensou por 1s",
  "qual o nome do governador do acre (leitura contextual-comparativa). evidencia-guia: ...",
].join("\n");

const latest = extractLatestUserUtterance(noisyInput);
assert(latest === "qual o nome do governador do acre", "expected latest useful utterance");

const filtered = filterInternalArtifacts([
  "Resposta:",
  "O governador do Acre e Gladson Cameli.",
  "Sequencia de tarefas: Identificar objetivo -> responder.",
  "Raciocinio multihipotese: q-branch-1: 0.52.",
].join("\n"));

assert(filtered.text.includes("Gladson Cameli"), "expected factual sentence to be preserved");
assert(!/q-branch|raciocinio multihipotese|sequencia de tarefas/i.test(filtered.text), "expected internal artifacts to be removed");
assert(filtered.removedCount >= 2, "expected removed artifacts counter");
