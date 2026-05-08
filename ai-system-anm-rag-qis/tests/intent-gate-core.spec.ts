import { runIntentGate } from "../src/01-input-layer/02-intent-gate-core/intent-gate";
import { evaluateGreetingFastLane } from "../src/01-input-layer/03-greeting-fast-lane-core/greeting-fast-lane-bridge";
import { buildTextAnalysisSnapshot } from "../src/shared/text-processing/text-analysis-snapshot";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runCase(text: string, recentTurns: Array<{ role: "user" | "assistant"; content: string }> = []) {
  const snapshot = buildTextAnalysisSnapshot(text);
  const greeting = evaluateGreetingFastLane({
    text,
    quickIntent: "chat",
    quickComplexity: 0.1,
    quickAmbiguity: 0.1,
    tokenCount: snapshot.tokenCount,
    questionCount: snapshot.questionCount,
    safetyAction: "allow",
  });

  return runIntentGate({
    text,
    snapshot,
    quickIntent: "chat",
    quickComplexity: 0.1,
    quickAmbiguity: 0.1,
    safetyAction: "allow",
    greeting,
    recentTurns,
  });
}

const pureGreeting = runCase("oi");
assert(pureGreeting.primaryIntent === "pure_greeting", "oi should be pure_greeting");
assert(pureGreeting.shouldBypassDeepPipeline, "oi should bypass deep pipeline");
assert(
  pureGreeting.routingRecommendation === "direct_social_response",
  "oi should route to direct_social_response",
);

const greetingWithPayload = runCase("oi, me ajuda nisso");
assert(
  greetingWithPayload.primaryIntent === "greeting_with_request",
  "greeting + payload should be greeting_with_request",
);
assert(
  !greetingWithPayload.shouldBypassDeepPipeline,
  "greeting with payload should not bypass deep pipeline",
);

const contextualValidation = runCase("isso esta certo?", [
  { role: "user", content: "eu adicionei no request-router" },
  { role: "assistant", content: "ok, valide o ponto de integracao" },
]);
assert(contextualValidation.hasContextDependency, "contextual validation should have context dependency");
assert(
  contextualValidation.minimalDepth === "contextual" || contextualValidation.minimalDepth === "analytical",
  "contextual validation should require contextual or analytical depth",
);
assert(
  contextualValidation.routingRecommendation === "deep_pipeline_required",
  "contextual validation should route to deep_pipeline_required",
);

const shortComparison = runCase("qual fica melhor?");
assert(shortComparison.hasComparisonSignal, "short comparison should detect comparison signal");
assert(
  shortComparison.minimalDepth === "contextual" || shortComparison.minimalDepth === "analytical",
  "short comparison should not be trivial",
);
assert(!shortComparison.shouldBypassDeepPipeline, "short comparison should not bypass deep pipeline");

const shortDefinition = runCase("quem e medeiros?");
assert(
  shortDefinition.minimalDepth === "contextual" || shortDefinition.minimalDepth === "analytical",
  "short definition query should not be treated as trivial",
);
assert(
  shortDefinition.routingRecommendation === "deep_pipeline_required",
  "short definition query should route to deep pipeline",
);

// __JEST_SMOKE_TEST__: ensures Jest counts at least one test in this spec file.
test("spec smoke", () => {
  expect(true).toBe(true);
});
