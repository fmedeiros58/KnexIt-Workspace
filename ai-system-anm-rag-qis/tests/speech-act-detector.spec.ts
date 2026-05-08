/**
 * Responsabilidade do arquivo:
 * - Validar classificacao basica de atos de fala no nucleo pragmatico.
 * - Cobrir pergunta e pedido/instrucao.
 */
import { speechActDetector } from "../src/02-language-layer/pragmatic-language-core/speech-act-detector";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

export function speechActDetectorSpec(): void {
  const question = speechActDetector({ text: "como funciona isso?" });
  assert(question.speechAct === "question", "expected question speech act");

  const request = speechActDetector({ text: "por favor, ajuste este modulo" });
  assert(request.speechAct === "instruction" || request.speechAct === "request", "expected request/instruction speech act");

  const followUp = speechActDetector({ text: "entao faca" });
  assert(followUp.speechAct === "instruction" || followUp.speechAct === "request", "expected follow-up directive as instruction/request");
}

speechActDetectorSpec();


// __JEST_SMOKE_TEST__: ensures Jest counts at least one test in this spec file.
test("spec smoke", () => {
  expect(true).toBe(true);
});
