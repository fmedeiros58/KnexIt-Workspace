import { createInitialProcessingState } from "../../src/bridges/contracts/processing-state";

const state = createInitialProcessingState("teste");
if (state.rawMessage !== "teste") {
  throw new Error("processing state init failed");
}
