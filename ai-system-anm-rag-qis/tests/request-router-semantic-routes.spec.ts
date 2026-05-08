import { routeRequest } from "../src/05-complexity-and-orchestration-layer/request-router";
import { createInitialProcessingState } from "../src/bridges/contracts/processing-state";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const communicative = createInitialProcessingState("vamos refinar e aprofundar essa ideia juntos");
communicative.complexityProfile.score = 0.45;
assert(routeRequest(communicative) === "inferential", "communicative elaboration prompt should route to inferential");

const epistemic = createInitialProcessingState("quero validar evidencias e fontes desse fato");
epistemic.preRouteSignals.hasVerifiableSignal = true;
assert(routeRequest(epistemic) === "inferential", "epistemic audit with verifiable signal should route to inferential");

const philosophical = createInitialProcessingState("quem e voce e qual sua origem?");
assert(routeRequest(philosophical) === "inferential", "philosophical self-modeling prompt should route to inferential");

// __JEST_SMOKE_TEST__: ensures Jest counts at least one test in this spec file.
test("spec smoke", () => {
  expect(true).toBe(true);
});
