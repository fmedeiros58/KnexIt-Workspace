import { runInputPreRouteScan } from "../src/01-input-layer/input-pre-route-scan";
import { createInitialProcessingState } from "../src/bridges/contracts/processing-state";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const pureGreetingState = runInputPreRouteScan(createInitialProcessingState("boa tarde"));
assert(
  pureGreetingState.preRouteSignals.intentGatePrimaryIntent === "pure_greeting",
  "pure greeting should map to pure_greeting primary intent",
);
assert(
  pureGreetingState.preRouteSignals.intentGateShouldBypassDeepPipeline === true,
  "pure greeting should bypass deep pipeline",
);

const contextualState = createInitialProcessingState("entao seria aqui?");
contextualState.recentTurns = [
  { role: "user", content: "no request-router eu mexi no route floor" },
  { role: "assistant", content: "ok, onde voce quer integrar o gate?" },
];
const scannedContextualState = runInputPreRouteScan(contextualState);
assert(
  scannedContextualState.preRouteSignals.intentGateHasContextDependency === true,
  "short contextual question should detect context dependency",
);
assert(
  scannedContextualState.preRouteSignals.intentGateShouldUseRecentConversationContext === true,
  "short contextual question should require recent conversation context",
);

