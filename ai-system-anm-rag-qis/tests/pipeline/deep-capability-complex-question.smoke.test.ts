import { runPipelineConductor } from "../../src/00-myelinated-pipeline-core/pipeline-conductor";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function shouldProduceDeepAnalyticalAnswerForComplexDecisionPrompt(): Promise<void> {
  const question =
    "Uma universidade publica da Amazonia recebeu recursos limitados e precisa decidir entre tres prioridades: ampliar assistencia estudantil, investir em pesquisa aplicada a biodiversidade ou modernizar a infraestrutura digital do ensino. Analise o problema como um sistema complexo. Identifique as variaveis centrais, explicite as premissas, construa criterios de decisao com pesos justificados, apresente ao menos duas alternativas de priorizacao, indique riscos e consequencias de curto e longo prazo, faca a critica mais forte contra sua propria recomendacao e, ao final, reformule sua resposta supondo que o orcamento sofra corte de 40%.";

  const result = await runPipelineConductor({ rawMessage: question });
  const response = `${result.responseText || ""}`;
  const normalized = response
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  assert(response.length >= 500, "deep capability answer should be substantially detailed");
  assert(normalized.includes("premissas explicitas"), "answer should include explicit premises");
  assert(/criterios?\s+de\s+decisao/.test(normalized), "answer should include weighted criteria");
  assert(normalized.includes("alternativa 1"), "answer should include at least alternative 1");
  assert(normalized.includes("alternativa 2"), "answer should include at least alternative 2");
  assert(normalized.includes("critica mais forte"), "answer should include strongest self-critique");
  assert(normalized.includes("corte de 40%"), "answer should include budget-cut reformulation");
  assert(
    !normalized.includes("me diga em uma frase o que voce quer que eu faca agora"),
    "deep capability answer should not degrade to clarification fallback",
  );

  const generationEvents = result.state.trace.filter((event) => event.layer === "generation").map((event) => event.action);
  const usedChatFallback = generationEvents.some((action) =>
    /chat_fallback_generated|chat_fallback_priority_generated|chat_clarification_fallback_generated/i.test(action || ""),
  );
  assert(!usedChatFallback, "deep turn should not use conversational generation fallback");
}

void shouldProduceDeepAnalyticalAnswerForComplexDecisionPrompt();
