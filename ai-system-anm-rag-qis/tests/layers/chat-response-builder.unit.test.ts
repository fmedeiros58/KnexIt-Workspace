import type { ProcessingState } from "../../src/bridges/contracts/processing-state";
import { createInitialProcessingState } from "../../src/bridges/contracts/processing-state";
import {
  buildConversationalFallback,
  isEchoLike,
} from "../../src/14-reasoning-and-generation-layer/draft-generation-core/chat-response-builder";

function createChatState(message: string): ProcessingState {
  const state = createInitialProcessingState(message);
  state.selectedMode = "chat";
  state.complexityProfile.score = 0.2;
  state.retrievedEvidence = [];
  state.retrievedSources = [];
  state.userProfile = { resolvedIntent: "chat" };
  return state;
}

function shouldHandleGreeting() {
  const state = createChatState("oi");
  const response = buildConversationalFallback(state);
  if (!response || !/como posso te ajudar/i.test(response)) {
    throw new Error("greeting fallback should produce conversational response");
  }
}

function shouldHandlePreferredName() {
  const state = createChatState("meu nome e medeiros, pode me chamar de medeiros");
  const response = buildConversationalFallback(state);
  if (!response || !/medeiros/i.test(response)) {
    throw new Error("name preference should be acknowledged");
  }
}

function shouldAskForNameWhenUserOffersName() {
  const state = createChatState("posso te dizer meu nome?");
  const response = buildConversationalFallback(state);
  if (!response || !/qual nome voce quer que eu use/i.test(response)) {
    throw new Error("name-offer prompt should be handled without echo");
  }
}

function shouldAskForNameWhenUserUsesPodeForm() {
  const state = createChatState("pode te dizer meu nome?");
  const response = buildConversationalFallback(state);
  if (!response || !/qual nome voce quer que eu use/i.test(response)) {
    throw new Error("pode-form should also ask for preferred name");
  }
}

function shouldRecallKnownNameFromHistory() {
  const state = createChatState("vc pode me dizer entao, qual o meu nome?");
  state.recentTurns = [
    { role: "user", content: "pode me chamar de medeiros?" },
    { role: "assistant", content: "Perfeito, Medeiros. Vou te chamar assim de agora em diante." },
  ];
  const response = buildConversationalFallback(state);
  if (!response || !/seu nome e medeiros/i.test(response)) {
    throw new Error("known name should be recalled from history");
  }
}

function shouldDetectEcho() {
  const echo = isEchoLike(
    "meu nome e medeiros, pode passar a me chamar de medeiros de agora em diante?",
    "meu nome e medeiros, pode passar a me chamar de medeiros de agora em diante?",
  );
  if (!echo) {
    throw new Error("echo-like text should be detected");
  }
}

function shouldNotFallbackForVerifiableQuestionOnNonMinimumRoute() {
  const state = createChatState("qual o nome do governador do acre?");
  state.executionPlan.selectedRoute = "quantum-state";
  const response = buildConversationalFallback(state);
  if (response !== null) {
    throw new Error("verifiable question on non-minimum route should not use conversational fallback");
  }
}

function shouldNotFallbackForResearchRequestEvenOnMinimumRoute() {
  const state = createChatState(
    "vc pode buscar um artigo sobre alostase em adolescentes em vulnerabilidade social?",
  );
  state.executionPlan.selectedRoute = "minimum";
  const response = buildConversationalFallback(state);
  if (response !== null) {
    throw new Error("research request should bypass conversational fallback");
  }
}

function shouldHandleRedoCommandWithTargetPrompt() {
  const state = createChatState("entao faca");
  const response = buildConversationalFallback(state);
  if (!response || !/posso refazer agora/i.test(response)) {
    throw new Error("redo command should trigger explicit re-search guidance");
  }
}

function shouldNotFallbackForReferentialFactualFollowUp() {
  const state = createChatState("ele foi eleito quando?");
  state.recentTurns = [
    { role: "user", content: "qual o nome do presidente dos estados unidos?" },
    { role: "assistant", content: "O presidente dos Estados Unidos e Donald Trump." },
  ];
  const response = buildConversationalFallback(state);
  if (response !== null) {
    throw new Error("referential factual follow-up should bypass conversational fallback");
  }
}

shouldHandleGreeting();
shouldHandlePreferredName();
shouldAskForNameWhenUserOffersName();
shouldAskForNameWhenUserUsesPodeForm();
shouldRecallKnownNameFromHistory();
shouldDetectEcho();
shouldNotFallbackForVerifiableQuestionOnNonMinimumRoute();
shouldNotFallbackForResearchRequestEvenOnMinimumRoute();
shouldHandleRedoCommandWithTargetPrompt();
shouldNotFallbackForReferentialFactualFollowUp();
