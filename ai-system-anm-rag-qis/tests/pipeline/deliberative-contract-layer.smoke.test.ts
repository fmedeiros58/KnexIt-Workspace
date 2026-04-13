import { runPipelineConductor } from "../../src/00-myelinated-pipeline-core/pipeline-conductor";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function shouldActivateDeliberativeContractAndKeepDeepCoverage(): Promise<void> {
  const prompt =
    "Considere um sistema social com tres principios normativos obrigatorios e faca: (a) demonstre formalmente o conflito; (b) diferencie contradicao de inconsistencia de aplicacao; (c) proponha dois modelos; (d) avalie custos logicos, morais e institucionais; (e) faca a melhor objecao contra a solucao preferida; (f) reformule sob incerteza de medicao; (g) explicite pressupostos nao provados.";

  const result = await runPipelineConductor({ rawMessage: prompt });
  const deliberative = result.state.generalTaskDeliberationState;
  const response = `${result.responseText || ""}`;
  const normalized = response
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  assert(Boolean(deliberative?.isActive), "general deliberative contract layer should be active");
  assert((deliberative?.taskArchetypes?.length || 0) >= 2, "task archetypes should be mapped");
  assert((deliberative?.cognitiveDemands?.length || 0) >= 2, "cognitive demands should be mapped");
  assert((deliberative?.obligationGraph?.length || 0) >= 6, "obligations should be extracted");
  assert((deliberative?.coverageReport?.expected || 0) >= 6, "coverage report should be initialized");
  assert(response.length >= 520, "response should be long enough for multi-obligation analytical prompt");
  assert(
    (deliberative?.reasoningContract?.requiredSections || []).length >= 5,
    "reasoning contract should include a structured section plan",
  );
  assert((deliberative?.solutionModels?.length || 0) >= 2, "solution-space expander should produce alternatives");
  assert(/\b(pressupostos|premissas|sem provar|limites)\b/.test(normalized), "response should expose assumptions or limits");
}

async function shouldPreserveStructuredPromptInsteadOfCollapsingToLastSubitem(): Promise<void> {
  const previousRuntime = process.env.AI_SYSTEM_ENABLE_LLM_RUNTIME;
  process.env.AI_SYSTEM_ENABLE_LLM_RUNTIME = "0";
  try {
    const prompt = [
      "Considere um sistema social idealizado com três princípios normativos obrigatórios:",
      "(1) nenhuma decisão coletiva pode reduzir a liberdade básica de um indivíduo inocente;",
      "(2) toda decisão coletiva deve maximizar o bem-estar agregado;",
      "(3) toda decisão coletiva deve ser justificável por uma regra universal que possa ser aplicada sem exceção.",
      "",
      "Agora suponha que, em certas circunstâncias, qualquer decisão possível viola pelo menos um desses princípios.",
      "Sem recorrer inicialmente a autores, escolas filosóficas ou exemplos históricos, faça o seguinte:",
      "(a) demonstre formalmente por que o conflito entre os três princípios pode ser inevitável;",
      "(b) diga se esse conflito revela uma contradição real do sistema ou apenas uma inconsistência de aplicação;",
      "(c) proponha ao menos dois modelos de solução, cada um preservando ao máximo os três princípios;",
      "(d) mostre qual preço lógico, moral e institucional cada modelo paga;",
      "(e) construa a melhor objeção possível contra a sua própria solução preferida;",
      "(f) reformule sua conclusão supondo agora que liberdade básica e bem-estar agregado não podem ser medidos com precisão, mas apenas estimados;",
      "(g) ao final, explicite o que sua resposta pressupôs sem provar.",
    ].join("\n");

    const result = await runPipelineConductor({ rawMessage: prompt });
    const deliberative = result.state.generalTaskDeliberationState;
    const normalizedPrompt = `${result.state.normalizedMessage || ""}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    assert(
      normalizedPrompt.includes("considere um sistema social idealizado"),
      "normalized prompt should preserve the opening of a structured single-turn analytical task",
    );
    assert(
      normalizedPrompt.includes("(g) ao final, explicite o que sua resposta"),
      "normalized prompt should preserve later obligations instead of reducing the message to the last item only",
    );
    assert((deliberative?.obligationGraph?.length || 0) >= 7, "multiline structured prompt should yield full obligation extraction");
    assert(
      (deliberative?.reasoningContract?.requiredSections || []).length >= 5,
      "full obligation extraction should produce a non-trivial reasoning contract",
    );
  } finally {
    if (typeof previousRuntime === "string") process.env.AI_SYSTEM_ENABLE_LLM_RUNTIME = previousRuntime;
    else delete process.env.AI_SYSTEM_ENABLE_LLM_RUNTIME;
  }
}

async function shouldGeneralizeBeyondTheNormativeExamplePrompt(): Promise<void> {
  const previousRuntime = process.env.AI_SYSTEM_ENABLE_LLM_RUNTIME;
  process.env.AI_SYSTEM_ENABLE_LLM_RUNTIME = "0";
  try {
    const prompt = [
      "Meu sistema responde rapido, mas superficialmente, e eu preciso corrigir isso sem aumentar muito a latencia.",
      "Identifique a falha principal, compare duas estrategias de correcao, escolha a mais robusta, ataque a sua propria escolha e diga quais pressupostos voce usou sem provar.",
    ].join(" ");

    const result = await runPipelineConductor({ rawMessage: prompt });
    const deliberative = result.state.generalTaskDeliberationState;
    const normalizedResponse = `${result.responseText || ""}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    assert(Boolean(deliberative?.isActive), "general deliberative contract should activate for non-normative multi-demand prompts");
    assert(
      (deliberative?.taskArchetypes || []).some((item) => item === "diagnose" || item === "decide" || item === "criticize"),
      "generalization prompt should map to task archetypes beyond the normative example family",
    );
    assert((deliberative?.obligationGraph?.length || 0) >= 4, "non-example prompt should still generate multiple obligations");
    assert(
      /\b(falha|estrategia|escolha|objecao|pressupostos|limites)\b/.test(normalizedResponse),
      "response should execute the diagnostic/comparative/objection pattern without depending on the original test topic",
    );
  } finally {
    if (typeof previousRuntime === "string") process.env.AI_SYSTEM_ENABLE_LLM_RUNTIME = previousRuntime;
    else delete process.env.AI_SYSTEM_ENABLE_LLM_RUNTIME;
  }
}

void shouldActivateDeliberativeContractAndKeepDeepCoverage()
  .then(shouldPreserveStructuredPromptInsteadOfCollapsingToLastSubitem)
  .then(shouldGeneralizeBeyondTheNormativeExamplePrompt);
