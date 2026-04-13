/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: orchestration-to-memory-bridge
 * Responsibility: Validate the handoff from orchestration to memory after adaptive contract resolution.
 * Primary Inputs: ProcessingState after orchestration planning.
 * Primary Outputs: The same ProcessingState if structural requirements are satisfied.
 * Upstream Dependencies: bridges/contracts/layer-handoff-contract, bridges/contracts/processing-state
 * Downstream Dependencies: 06-memory-and-plasticity-layer
 * Invariants: Memory receives a complexity profile, execution plan and adaptive contract scaffold.
 * Failure Modes: Missing orchestration outputs must fail fast before memory execution.
 * Audit Events: orchestration_memory_handoff_checked
 * Notes: The adaptive contract may still be null in degraded compatibility scenarios, but new orchestration should populate it.
 */
import { assertHandoffContract } from "../bridges/contracts/layer-handoff-contract";
import type { ProcessingState } from "../bridges/contracts/processing-state";

const ORCHESTRATION_TO_MEMORY_CONTRACT = {
  from: "orchestration",
  to: "memory",
  requiredFields: ["complexityProfile", "executionPlan"],
  requiredReads: ["motorRoutingAnalysis", "profileSelectionResult"],
} as const;

export function handoffOrchestrationToMemory(state: ProcessingState): ProcessingState {
  assertHandoffContract(state, ORCHESTRATION_TO_MEMORY_CONTRACT);
  return state;
}
