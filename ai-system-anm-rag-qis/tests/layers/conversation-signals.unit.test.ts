import {
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

const remembersName = "sou medeiros. ainda lembra do meu nome?";
assert(isNameRecallPrompt(remembersName), "name-recall phrasing with 'lembra do meu nome' should be recognized");
assert(extractPreferredNameFromText(remembersName) === "Medeiros", "name should be extracted from 'sou <nome>'");

const mixed = [
  "qual o nome do presidente dos estados unidos?",
  "Pensou por 1s",
  "ele foi eleito quando?",
].join("\n");

assert(
  extractLatestUserUtterance(mixed).toLowerCase().includes("ele foi eleito quando"),
  "latest user utterance should preserve follow-up question",
);
