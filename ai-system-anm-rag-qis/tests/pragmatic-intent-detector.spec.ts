/**
 * Responsabilidade do arquivo:
 * - Validar deteccao de intencao pragmatica em comandos de continuidade.
 * - Garantir que follow-up diretivo seja classificado como execute_change.
 */
import { pragmaticIntentDetector } from "../src/02-language-layer/pragmatic-language-core/pragmatic-intent-detector";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const followUp = pragmaticIntentDetector({
  text: "entao faca",
  speechAct: "statement",
});

assert(followUp.intent === "execute_change", "expected execute_change for follow-up directive");

const infoQuestion = pragmaticIntentDetector({
  text: "qual o nome do presidente do brasil?",
  speechAct: "question",
});

assert(infoQuestion.intent === "ask_information", "expected ask_information for factual question");


// __JEST_SMOKE_TEST__: ensures Jest counts at least one test in this spec file.
test("spec smoke", () => {
  expect(true).toBe(true);
});
