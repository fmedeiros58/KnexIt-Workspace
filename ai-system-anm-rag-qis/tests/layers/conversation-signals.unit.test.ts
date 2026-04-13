import {
  isAssistantCreatorPrompt,
  isAssistantIdentityPrompt,
  isAssistantNameOriginPrompt,
  extractLatestUserUtterance,
  extractPreferredNameFromText,
  isNameRecallPrompt,
  isConversationalPrompt,
  isReferentialFactualPrompt,
} from "../../src/shared/utils/conversation-signals";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const followUp = "ele foi eleito quando?";
assert(isReferentialFactualPrompt(followUp), "follow-up factual question should be recognized");
assert(!isConversationalPrompt(followUp), "follow-up factual question should not be treated as small talk");

const factual = "qual o nome do prefeito de rio branco?";
assert(!isConversationalPrompt(factual), "factual civic question should not be conversational");

const greeting = "oi";
assert(isConversationalPrompt(greeting), "greeting should remain conversational");
assert(isConversationalPrompt("bom dia leticia"), "greeting family should include direct address variants");

const remembersName = "sou medeiros. ainda lembra do meu nome?";
assert(isNameRecallPrompt(remembersName), "name-recall phrasing with 'lembra do meu nome' should be recognized");
assert(extractPreferredNameFromText(remembersName) === "Medeiros", "name should be extracted from 'sou <nome>'");
assert(isNameRecallPrompt("qual nome voce tem salvo pra mim?"), "expanded name-recall family should be recognized");

assert(isAssistantIdentityPrompt("me diz seu nome"), "assistant identity family should include colloquial asks");
assert(isAssistantNameOriginPrompt("o que quer dizer leticia?"), "name-origin family should include meaning variants");
assert(isAssistantCreatorPrompt("quem te criou?"), "creator family should include creator variants");
assert(isConversationalPrompt("quem te criou?"), "creator prompts should stay conversational");

const mixed = [
  "qual o nome do presidente dos estados unidos?",
  "Pensou por 1s",
  "ele foi eleito quando?",
].join("\n");

assert(
  extractLatestUserUtterance(mixed).toLowerCase().includes("ele foi eleito quando"),
  "latest user utterance should preserve follow-up question",
);

const structuredSingleTurnPrompt = [
  "Considere um sistema social idealizado com três princípios normativos obrigatórios:",
  "(1) nenhuma decisão coletiva pode reduzir a liberdade básica de um indivíduo inocente;",
  "(2) toda decisão coletiva deve maximizar o bem-estar agregado;",
  "(3) toda decisão coletiva deve ser justificável por uma regra universal que possa ser aplicada sem exceção.",
  "",
  "Agora suponha que, em certas circunstâncias, qualquer decisão possível viola pelo menos um desses princípios.",
  "(a) demonstre formalmente o conflito;",
  "(b) proponha dois modelos;",
  "(c) explicite pressupostos não provados.",
].join("\n");
const preservedStructuredPrompt = extractLatestUserUtterance(structuredSingleTurnPrompt);
assert(
  preservedStructuredPrompt.toLowerCase().includes("considere um sistema social idealizado"),
  "structured single-turn prompt should preserve its opening instead of collapsing to the last line",
);
assert(
  preservedStructuredPrompt.toLowerCase().includes("(c) explicite pressupostos"),
  "structured single-turn prompt should preserve later obligations as part of the same user turn",
);

test('bootstrap assertions executed', () => {
  expect(true).toBe(true);
});
