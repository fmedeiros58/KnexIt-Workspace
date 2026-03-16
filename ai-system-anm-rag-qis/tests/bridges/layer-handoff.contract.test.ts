import { assertHandoffContract } from "../../src/bridges/contracts/layer-handoff-contract";
import { createInitialProcessingState } from "../../src/bridges/contracts/processing-state";

const state = createInitialProcessingState("oi");
assertHandoffContract(state, {
  from: "input",
  to: "context",
  requiredFields: ["normalizedMessage", "inputSignals", "sessionState"],
});
