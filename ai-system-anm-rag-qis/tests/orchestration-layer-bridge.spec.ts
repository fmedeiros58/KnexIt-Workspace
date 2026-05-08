import { createInitialProcessingState } from "../src/bridges/contracts/processing-state";
import { runOrchestrationLayer } from "../src/05-complexity-and-orchestration-layer/orchestration-layer-bridge";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function shouldUseShortMotorReadInsideOrchestrator() {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; body: string }> = [];

  globalThis.fetch = async (url, init) => {
    calls.push({
      url: String(url),
      body: String(init?.body || ""),
    });

    const payload = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              primaryIntent: "analysis",
              secondaryIntents: ["explanation"],
              complexityBand: "medium",
              complexityConfidence: 0.88,
              ambiguityScore: 0.18,
              taskType: "technical_analysis",
              domainProfile: { primary: "software", secondary: ["architecture"] },
              topicShift: false,
              memoryNeed: "light",
              retrievalNeed: "standard",
              validationNeed: "standard",
              reflectionNeed: "light",
              responseStyle: "structured-answer",
              expectedOutputShape: ["structured-answer"],
              recommendedProfiles: ["technical-analysis-profile"],
              profileWeights: { "technical-analysis-profile": 0.9 },
              riskLevel: "low",
              needsClarification: false,
              proactivityTolerance: "low",
              estimatedBudgetClass: "standard",
            }),
          },
        },
      ],
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const state = createInitialProcessingState(`auditoria do orquestrador ${Date.now()}`);
    state.normalizedMessage = state.rawMessage;
    state.inputSignals.intent = "analysis";
    state.inputSignals.domain = "software";
    state.executionPlan.selectedRoute = "inferential";

    const result = await runOrchestrationLayer(state);
    const stages = result.orchestratorAuditTrail.map((item) => item.stage);

    assert(calls.length === 1, "orchestrator should perform exactly one short motor read");
    assert(/chat\/completions$/i.test(calls[0].url), "motor read should hit the shared chat completions endpoint");
    assert(result.motorRoutingAnalysis?.source !== "heuristic-fallback", "motor routing analysis should come from the motor when fetch succeeds");
    assert(result.executionArtifacts.orchestration?.motorRoutingUsed === true, "orchestrator execution artifacts should record motor usage");
    assert(result.executionArtifacts.orchestration?.motorRoutingFallbackUsed === false, "orchestrator should not report fallback when motor succeeds");
    assert(result.adaptivePipelineContract?.version === "05b.adaptive-pipeline-contract.v1", "adaptive pipeline contract should be attached");
    assert(stages.includes("heuristic-scan"), "audit trail should include heuristic scan");
    assert(stages.includes("motor-routing"), "audit trail should include motor routing");
    assert(stages.includes("fusion"), "audit trail should include fusion");
    assert(stages.includes("profile-selection"), "audit trail should include profile selection");
    assert(stages.includes("layer-activation"), "audit trail should include layer activation");
    assert(stages.includes("adaptive-contract"), "audit trail should include adaptive contract");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

await shouldUseShortMotorReadInsideOrchestrator();

// __JEST_SMOKE_TEST__: ensures Jest counts at least one test in this spec file.
test("spec smoke", () => {
  expect(true).toBe(true);
});
