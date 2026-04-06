import { runPipelineConductor } from "../../src/00-myelinated-pipeline-core/pipeline-conductor";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function normalize(value: string): string {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function shouldAnswerEliteNormativeQuestionWithStructuredDepth(): Promise<void> {
  const prevLlmRuntime = process.env.AI_SYSTEM_ENABLE_LLM_RUNTIME;
  process.env.AI_SYSTEM_ENABLE_LLM_RUNTIME = "0";
  try {
    const question =
      "Considere um sistema social idealizado com tres principios normativos obrigatorios: (1) nenhuma decisao coletiva pode reduzir a liberdade basica de um individuo inocente; (2) toda decisao coletiva deve maximizar o bem-estar agregado; (3) toda decisao coletiva deve ser justificavel por uma regra universal que possa ser aplicada sem excecao. Agora suponha que, em certas circunstancias, qualquer decisao possivel viola pelo menos um desses principios. Sem recorrer inicialmente a autores, escolas filosoficas ou exemplos historicos, faca o seguinte: (a) demonstre formalmente por que o conflito entre os tres principios pode ser inevitavel; (b) diga se esse conflito revela uma contradicao real do sistema ou apenas uma inconsistência de aplicacao; (c) proponha ao menos dois modelos de solucao; (d) mostre qual preco logico, moral e institucional cada modelo paga; (e) construa a melhor objecao possivel contra sua propria solucao preferida; (f) reformule sua conclusao supondo que liberdade basica e bem-estar agregado nao podem ser medidos com precisao, mas apenas estimados; (g) explicite o que sua resposta pressupos sem provar.";

    const result = await runPipelineConductor({ rawMessage: question });
    const response = `${result.responseText || ""}`;
    const normalized = normalize(response);

    assert(result.route === "inferential", "elite normative question should use deep inferential route");
    assert(response.length >= 1200, "elite normative answer should be long and structured");
    assert(normalized.includes("(a)"), "answer should include section (a)");
    assert(normalized.includes("(b)"), "answer should include section (b)");
    assert(normalized.includes("(c)"), "answer should include section (c)");
    assert(normalized.includes("(d)"), "answer should include section (d)");
    assert(normalized.includes("(e)"), "answer should include section (e)");
    assert(normalized.includes("(f)"), "answer should include section (f)");
    assert(normalized.includes("(g)"), "answer should include section (g)");
    assert(
      normalized.includes("premissas que a resposta usou sem provar"),
      "answer should explicitly list unproven assumptions",
    );
    assert(!/\bola, usuario\b/.test(normalized), "response should avoid continuity-breaking greeting artifact");
    assert(!/\bcontexto atual\b/.test(normalized), "response should avoid backend artifact phrase in final text");
  } finally {
    process.env.AI_SYSTEM_ENABLE_LLM_RUNTIME = prevLlmRuntime;
  }
}

void shouldAnswerEliteNormativeQuestionWithStructuredDepth();
