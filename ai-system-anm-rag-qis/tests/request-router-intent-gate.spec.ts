import { runInputPreRouteScan } from "../src/01-input-layer/input-pre-route-scan";
import { selectPipelineRoute } from "../src/00-myelinated-pipeline-core/pipeline-route-selector";
import { isAssistantIdentityFamilyPrompt, routeRequest } from "../src/05-complexity-and-orchestration-layer/request-router";
import { createInitialProcessingState } from "../src/bridges/contracts/processing-state";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const greetingState = runInputPreRouteScan(createInitialProcessingState("oi"));
assert(selectPipelineRoute(greetingState) === "minimum", "pure greeting should stay in minimum route");
assert(routeRequest(greetingState) === "minimum", "pure greeting should stay minimum in request-router");

const shortValidationState = createInitialProcessingState("isso esta certo?");
shortValidationState.recentTurns = [
  { role: "user", content: "adicionei no request-router" },
  { role: "assistant", content: "ok, valide se o ponto esta correto" },
];
const scannedValidationState = runInputPreRouteScan(shortValidationState);
const selectedValidationRoute = selectPipelineRoute(scannedValidationState);
const requestedValidationRoute = routeRequest(scannedValidationState);

assert(
  selectedValidationRoute === "inferential" || selectedValidationRoute === "quantum-state",
  "short contextual validation should route to deep pipeline",
);
assert(
  requestedValidationRoute === "inferential" || requestedValidationRoute === "quantum-state",
  "request-router should force deep pipeline for contextual validation",
);

const typoNameOriginPrompt = "e pq tte chamam assim?";
assert(
  isAssistantIdentityFamilyPrompt(typoNameOriginPrompt),
  "identity-family detector should handle typo variant of name-origin question",
);
const typoNameOriginState = runInputPreRouteScan(createInitialProcessingState(typoNameOriginPrompt));
assert(
  routeRequest(typoNameOriginState) === "inferential" ||
    routeRequest(typoNameOriginState) === "quantum-state",
  "name-origin typo should route to deep pipeline",
);

const identityWithDataAccessPrompt = "quem e medeiros? consulte no rag e no sql antes de responder";
const identityWithDataAccessState = runInputPreRouteScan(createInitialProcessingState(identityWithDataAccessPrompt));
const dataAccessRoute = routeRequest(identityWithDataAccessState);
assert(
  dataAccessRoute === "inferential" || dataAccessRoute === "quantum-state",
  "identity question requiring RAG/SQL consultation should escalate above reflective",
);

// __JEST_SMOKE_TEST__: ensures Jest counts at least one test in this spec file.
test("spec smoke", () => {
  expect(true).toBe(true);
});
