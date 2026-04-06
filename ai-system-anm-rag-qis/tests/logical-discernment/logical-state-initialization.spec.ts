import { createInitialProcessingState } from "../../src/bridges/contracts/processing-state";
import { buildPipelineState } from "../../src/00-myelinated-pipeline-core/pipeline-state-builder";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const base = createInitialProcessingState("teste");
assert(base.logicalFrame === null, "initial state should start with logicalFrame null");
assert(base.logicalAudit === null, "initial state should start with logicalAudit null");
assert(base.logicalDiscernmentScore === 0, "initial score should be zero");
assert(base.dominantPrinciple === "unknown", "initial dominant principle should be unknown");
assert(base.recommendedPracticalAction === null, "initial recommended practical action should be null");
assert(base.practicalReasoningFlags.length === 0, "initial practical reasoning flags should be empty");

const built = buildPipelineState({ rawMessage: "teste de pipeline logico" });
assert(built.logicalFrame === null, "pipeline bootstrap should preserve logicalFrame null before discernment layer");
assert(built.logicalAudit === null, "pipeline bootstrap should preserve logicalAudit null before output audit");
assert(built.dominantPrinciple === "unknown", "pipeline bootstrap should keep unknown dominant principle");
