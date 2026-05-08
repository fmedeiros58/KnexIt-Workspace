/**
 * @file pipeline-delivery-handoff.spec.ts
 * @description Valida o handoff final do pipeline contra regressao de transcript e mojibake.
 * @layer tests
 * @purpose Garantir que o condutor nao sobrescreva a entrega limpa da apresentacao com structuredResponse contaminado.
 * @inputs ProcessingState sintetico com deliveryPayload limpo e structuredResponse sujo.
 * @outputs Assercoes automatizadas sobre preservacao do texto final e limpeza fallback.
 * @dependsOn pipeline-delivery-handoff e processing-state.
 * @usedBy Runner de testes Node/tsx do repositorio ai-system-anm-rag-qis.
 * @invariants O handoff final nao deve reintroduzir Usuario, Leticia, Pensou por, continuity ou caractere de substituicao.
 * @notes Cobre regressao observada em respostas curtas de saudacao/check-in.
 */
import { createInitialProcessingState } from "../src/bridges/contracts/processing-state";
import { handoffPipelineDelivery } from "../src/00-myelinated-pipeline-core/pipeline-delivery-handoff";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const leaked = [
  "Estou funcionando normalmente, atendendo as suas perguntas.",
  "Usuário: qual a temperatura atual?",
  "Letícia: A temperatura atual, segundo os dados dispon�veis, e de 25 graus Celsius.",
  "Usuário: obrigado",
  "Letícia: De nada.",
  "Continuidade:",
  "continuity\\_anchor: como / vc / esta",
  "continuity\\_mode: continue",
].join(" ");

{
  const state = createInitialProcessingState("como vc está?");
  state.structuredResponse = leaked;
  state.deliveryPayload.text = "Estou funcionando normalmente, atendendo as suas perguntas.";
  state.executionArtifacts.presentation = {
    channel: "rest",
    format: "plain-text",
    selectedSerializer: "plain-text",
    adapters: [],
    serializers: [],
    streamControllers: [],
    streamChunkCount: 1,
    streamRecovered: false,
    retryPolicy: { maxAttempts: 0, baseBackoffMs: 0, jitterMs: 0 },
    utf8Repaired: true,
  };

  handoffPipelineDelivery(state);

  assert(
    state.deliveryPayload.text === "Estou funcionando normalmente, atendendo as suas perguntas.",
    "handoff should preserve already-clean presentation payload",
  );
  assert(!/Usu[aá]rio:|Let[ií]cia:|continuity\\?_mode|�/i.test(state.deliveryPayload.text), "clean delivery should remain clean");
}

{
  const state = createInitialProcessingState("como vc está?");
  state.structuredResponse = leaked;
  state.deliveryPayload.text = "";

  handoffPipelineDelivery(state);

  assert(state.deliveryPayload.text.startsWith("Estou funcionando normalmente"), "fallback should keep useful head");
  assert(!/Usu[aá]rio:|Let[ií]cia:|continuity\\?_mode|�/i.test(state.deliveryPayload.text), "fallback should sanitize contaminated structured response");
}

{
  const state = createInitialProcessingState("teste de entrega bloqueada");
  state.structuredResponse = "Resposta que nao deveria ser entregue.";
  state.deliveryPayload.text = "Resposta que nao deveria ser entregue.";
  state.executionArtifacts.criticalCouncil = {
    ...(state.executionArtifacts.criticalCouncil || {}),
    deliveryBlocked: true,
    revisionAttempts: 0,
  };

  handoffPipelineDelivery(state);

  assert(
    /^Ainda nao posso entregar uma resposta final com seguranca\b/i.test(state.deliveryPayload.text),
    "handoff should block delivery when critical council blocks delivery",
  );
}

{
  const state = createInitialProcessingState("teste de fechamento logico falho");
  state.structuredResponse = "Resposta que nao deveria ser entregue.";
  state.deliveryPayload.text = "Resposta que nao deveria ser entregue.";
  state.executionArtifacts.problemResolution = {
    reasoningNeed: "high",
    closurePassed: false,
    completionScore: 0,
    riskTypes: [],
    repairApplied: false,
    repairReasonCount: 0,
    missingVariables: [],
    unresolvedScenarios: [],
    violatedConstraints: [],
  };

  handoffPipelineDelivery(state);

  assert(
    /^Ainda nao posso entregar uma resposta final com seguranca\b/i.test(state.deliveryPayload.text),
    "handoff should block delivery when problem-resolution closure fails",
  );
}

// __JEST_SMOKE_TEST__: ensures Jest counts at least one test in this spec file.
test("spec smoke", () => {
  expect(true).toBe(true);
});
