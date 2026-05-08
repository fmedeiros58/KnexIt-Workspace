/**
 * Responsabilidade do arquivo:
 * - Validar regra de fast lane para saudações/conversa curta.
 * - Garantir que consultas informacionais continuem com pesquisa web ativa.
 */
import { shouldUseWebResearch } from "../src/07-knowledge-retrieval-and-research-layer/internet-research-core/web-research-router";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const conversational = shouldUseWebResearch({
  query: "oi",
  localSourceCount: 0,
  verifiable: false,
  conversationalPrompt: true,
});
assert(!conversational, "greeting should not block on web research");

const informational = shouldUseWebResearch({
  query: "qual o nome do governador do acre",
  localSourceCount: 0,
  verifiable: true,
  conversationalPrompt: false,
});
assert(informational, "informational query should use web research");


// __JEST_SMOKE_TEST__: ensures Jest counts at least one test in this spec file.
test("spec smoke", () => {
  expect(true).toBe(true);
});
