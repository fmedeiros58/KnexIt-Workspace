import { buildResponseLayoutPlan } from "../../src/18-presentation-and-delivery-layer/textual-layout-engine/response-layout-policy";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

{
  const plan = buildResponseLayoutPlan({
    text: "Resposta curta e direta sobre um ponto simples.",
    prompt: "responda rapidamente",
    hasCodeBlocks: false,
    hasCitations: false,
    hasMedia: false,
    hasEnumerativeSignals: false,
    requestedList: false,
    requestedHeading: false,
  });

  assert(plan.complexity === "micro" || plan.complexity === "short", "short text should map to micro/short");
  assert(plan.rhetoricalShape === "single_compact_paragraph", "short text should be compact paragraph");
}

{
  const plan = buildResponseLayoutPlan({
    text: "Primeiro argumento. Segundo argumento. Terceiro argumento com detalhamento. Quarto argumento com implicações.",
    prompt: "faça uma análise estruturada e com seções",
    hasCodeBlocks: false,
    hasCitations: true,
    hasMedia: false,
    hasEnumerativeSignals: false,
    requestedList: false,
    requestedHeading: true,
  });

  assert(plan.headingStrategy !== "none", "analysis with heading hint should not suppress headings");
  assert(plan.targetParagraphSentenceRange[0] >= 2, "analysis should target denser paragraphs");
}
