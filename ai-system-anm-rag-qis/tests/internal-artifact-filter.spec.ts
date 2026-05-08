/**
 * @file internal-artifact-filter.spec.ts
 * @description Valida a limpeza de artefatos internos no texto final de resposta.
 * @layer tests
 * @purpose Impedir regressao de vazamentos de raciocinio, continuidade e metadados no texto entregue.
 * @inputs Entradas sinteticas com resposta util misturada a marcadores internos.
 * @outputs Assercoes automatizadas sobre preservacao do texto util e remocao de artefatos.
 * @dependsOn internal-artifact-filter e conversation-signals.
 * @usedBy Runner de testes Node/tsx do repositorio ai-system-anm-rag-qis.
 * @invariants Respostas curtas antes de marcadores internos devem ser preservadas.
 * @notes Cobre tambem underscores escapados porque vazamentos reais chegam como continuity\_mode.
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
  "Sim, eu sou Leticia. Explicacao:",
  "A pergunta do usuario foi clara e objetiva.",
  "Continuidade: continuity_anchor: dizer / nome / pode / seu",
  "continuity\\_mode: continue",
].join("\n"));

assert(filtered.text.includes("Gladson Cameli"), "expected factual sentence to be preserved");
assert(filtered.text.includes("Sim, eu sou Leticia."), "expected useful short answer before explanation to be preserved");
assert(!/q-branch|raciocinio multihipotese|sequencia de tarefas|continuity\\?_anchor|continuity\\?_mode|continuidade|a pergunta do usuario|explicacao/i.test(filtered.text), "expected internal artifacts to be removed");
assert(filtered.removedCount >= 2, "expected removed artifacts counter");

const transcriptLeak = filterInternalArtifacts(
  "Estou funcionando normalmente. Usuario: qual a temperatura atual? Leticia: A temperatura atual, segundo os dados dispon�veis, e de 25 graus Celsius.",
);
assert(transcriptLeak.text === "Estou funcionando normalmente.", "expected transcript tail to be removed");
assert(!/Usuario:|Leticia:|�/i.test(transcriptLeak.text), "expected mojibake inside transcript tail to be removed");

const accentedTranscriptLeak = filterInternalArtifacts(
  "Retire a fruta da caixa rotulada como Maçãs e Laranjas. Usuário: obrigado Letícia, mas ainda há algo que não estou entendendo. LetíciaDesculpe-me, mas eu me equivoquei.",
);
assert(
  accentedTranscriptLeak.text === "Retire a fruta da caixa rotulada como Maçãs e Laranjas.",
  "expected accented transcript tail to be removed",
);
assert(!/Usuário:|Letícia/i.test(accentedTranscriptLeak.text), "expected accented role markers to be removed");

const repairTailLeak = filterInternalArtifacts(
  [
    "Resposta util e objetiva.",
    "",
    "Complemento de fechamento logico:",
    "- Modo de reparo recomendado: regenerate.",
    "- Variaveis ainda nao cobertas: entity_A, entity_B.",
  ].join("\n"),
);
assert(
  repairTailLeak.text === "Resposta util e objetiva.",
  "expected problem-resolution repair tail to be removed",
);

// __JEST_SMOKE_TEST__: ensures Jest counts at least one test in this spec file.
test("spec smoke", () => {
  expect(true).toBe(true);
});
