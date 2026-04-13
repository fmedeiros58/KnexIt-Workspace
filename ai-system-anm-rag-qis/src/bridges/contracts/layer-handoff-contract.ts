/**
 * ANM ARCHITECTURAL SPEC
 * Layer: bridges/contracts
 * Module: layer-handoff-contract
 * Responsibility: Define and validate structural contracts between adjacent layers of the descending pipeline.
 * Primary Inputs: ProcessingState snapshots and declarative handoff contracts.
 * Primary Outputs: Runtime handoff assertions and audit-friendly contract metadata.
 * Upstream Dependencies: shared/enums/pipeline-enums, processing-state
 * Downstream Dependencies: layer bridges, adaptive orchestration, audit collectors
 * Invariants: Contracts remain local to adjacent layer handoffs and do not introduce jump routing.
 * Failure Modes: Missing required reads or failed post-conditions must throw explicit handoff errors.
 * Audit Events: handoff_contract_checked, handoff_contract_failed
 * Notes: The legacy requiredFields API is preserved for compatibility while stronger fields are added.
 */
import type { PipelineLayerId } from "../../shared/enums/pipeline-enums";
import type { ProcessingState } from "./processing-state";

export interface HandoffPostCondition {
  description: string;
  validate: (state: ProcessingState) => boolean;
}

export interface LayerHandoffContract {
  from: PipelineLayerId;
  to: PipelineLayerId;
  requiredFields: ReadonlyArray<keyof ProcessingState>;
  requiredReads?: ReadonlyArray<keyof ProcessingState>;
  allowedWrites?: ReadonlyArray<keyof ProcessingState>;
  postConditions?: ReadonlyArray<HandoffPostCondition>;
  invariants?: readonly string[];
}

export function assertHandoffContract(state: ProcessingState, contract: LayerHandoffContract) {
  const requiredKeys = [
    ...contract.requiredFields,
    ...(contract.requiredReads || []),
  ];
  const missing = requiredKeys.filter((key) => state[key] === undefined || state[key] === null);
  if (missing.length) {
    throw new Error(
      `handoff ${contract.from}->${contract.to} missing required fields: ${missing.join(", ")}`,
    );
  }

  const failedPostConditions = (contract.postConditions || []).filter((item) => !item.validate(state));
  if (failedPostConditions.length) {
    throw new Error(
      `handoff ${contract.from}->${contract.to} failed post-conditions: ${failedPostConditions.map((item) => item.description).join(", ")}`,
    );
  }
}
