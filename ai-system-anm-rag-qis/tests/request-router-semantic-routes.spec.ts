import { routeRequest } from "../src/05-complexity-and-orchestration-layer/request-router";
import { createInitialProcessingState } from "../src/bridges/contracts/processing-state";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const communicative = createInitialProcessingState("vamos refinar e aprofundar essa ideia juntos");
communicative.complexityProfile.score = 0.45;
assert(routeRequest(communicative) === "reflective", "communicative elaboration prompt should route to reflective");

const epistemic = createInitialProcessingState("quero validar evidencias e fontes desse fato");
epistemic.preRouteSignals.hasVerifiableSignal = true;
assert(routeRequest(epistemic) === "quantum-state", "epistemic audit with verifiable signal should route to quantum-state");

const philosophical = createInitialProcessingState("quem e voce e qual sua origem?");
assert(routeRequest(philosophical) === "inferential", "philosophical self-modeling prompt should route to inferential");


test('bootstrap assertions executed', () => {
  expect(true).toBe(true);
});
