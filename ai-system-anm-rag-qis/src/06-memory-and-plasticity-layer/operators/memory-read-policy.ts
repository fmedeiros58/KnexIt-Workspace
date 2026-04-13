/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 06-memory-and-plasticity-layer
 * Module: operators/memory-read-policy
 * Responsibility: Resolve whether the memory layer should read aggressively or lightly.
 * Primary Inputs: ProcessingState and layer mode.
 * Primary Outputs: Memory read policy decision.
 * Upstream Dependencies: local memory-pressure-estimator
 * Downstream Dependencies: memory-layer
 * Invariants: Policy is recommendation-only and local.
 * Failure Modes: Missing signals degrade to light reads.
 * Audit Events: memory_read_policy_resolved
 * Notes: Keeps memory access policy inside the memory layer.
 */
import type { LayerMode } from "../../bridges/contracts/layer-mode";
import type { ProcessingState } from "../../bridges/contracts/processing-state";
import { memoryPressureEstimator } from "./memory-pressure-estimator";

export function memoryReadPolicy(state: ProcessingState, mode: LayerMode) {
  const pressure = memoryPressureEstimator(state, mode);
  return {
    shouldRead: mode !== "noop-intelligent",
    intensity: mode === "memory-heavy" || pressure.band === "high" ? "heavy" : pressure.band === "medium" ? "standard" : "light",
    reasons: pressure.band === "high" ? ["memory_pressure_high"] : ["memory_pressure_controlled"],
  };
}
