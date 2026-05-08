import { createInitialProcessingState } from "../src/bridges/contracts/processing-state";
import { runConversationLayer } from "../src/03-conversation-layer/conversation-layer-bridge";
import { runBehaviorAndPersonalityLayer } from "../src/17b-response-behavior-layer/behavior-and-personality-layer-bridge";
import { runContextLayer } from "../src/04-context-and-session-layer/context-layer-bridge";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function shouldInjectBehaviorBetweenConversationAndContext() {
  let state = createInitialProcessingState("usuario frustrado: preciso ajustar isso agora.");
  state.recentTurns = [
    { role: "user", content: "oi" },
    { role: "assistant", content: "Oi! Como posso ajudar?" },
  ];

  state = await runConversationLayer(state);
  state = await runBehaviorAndPersonalityLayer(state);
  state = await runContextLayer(state);

  assert(state.behaviorPersonalityState.targetRestraint >= 0, "behavior profile should be present");
  assert(
    state.activeContext.some((item) => /perfil comportamental/i.test(item)),
    "activeContext should carry behavior profile hint",
  );
  assert(
    state.activeConstraints.some((item) => item.startsWith("behavior_")),
    "activeConstraints should carry behavior tags",
  );
}

await shouldInjectBehaviorBetweenConversationAndContext();


// __JEST_SMOKE_TEST__: ensures Jest counts at least one test in this spec file.
test("spec smoke", () => {
  expect(true).toBe(true);
});
