/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 06-memory-and-plasticity-layer
 * Module: operators/memory-pressure-estimator
 * Responsibility: Estimate current memory pressure from runtime memory signals.
 * Primary Inputs: ProcessingState and layer mode.
 * Primary Outputs: Pressure score and band.
 * Upstream Dependencies: bridges/contracts/processing-state, bridges/contracts/layer-mode
 * Downstream Dependencies: memory-layer
 * Invariants: Estimation is local and bounded.
 * Failure Modes: Missing memory signals degrade to low pressure.
 * Audit Events: memory_pressure_estimated
 * Notes: Used to resolve memory read/write policies.
 */
import type { LayerMode } from "../../bridges/contracts/layer-mode";
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function memoryPressureEstimator(state: ProcessingState, mode: LayerMode) {
  const regulatory = state.memorySnapshot.regulatoryState;
  const nodular = state.memorySnapshot.nodularState;
  const rawScore = (regulatory.stressLoad * 0.42) + (nodular.attention * 0.34) + (nodular.priming * 0.24);
  const score = Math.max(0, Math.min(1, rawScore + (mode === "memory-heavy" ? 0.08 : 0)));
  return {
    score: Number(score.toFixed(4)),
    band: score >= 0.72 ? "high" : score >= 0.42 ? "medium" : "low",
  };
}
