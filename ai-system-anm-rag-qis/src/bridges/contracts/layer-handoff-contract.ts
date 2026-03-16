import type { PipelineLayerId } from "../../shared/enums/pipeline-enums";
import type { ProcessingState } from "./processing-state";

export interface LayerHandoffContract {
  from: PipelineLayerId;
  to: PipelineLayerId;
  requiredFields: ReadonlyArray<keyof ProcessingState>;
}

export function assertHandoffContract(state: ProcessingState, contract: LayerHandoffContract) {
  const missing = contract.requiredFields.filter((key) => state[key] === undefined || state[key] === null);
  if (missing.length) {
    throw new Error(
      `handoff ${contract.from}->${contract.to} missing required fields: ${missing.join(", ")}`,
    );
  }
}
