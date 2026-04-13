/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: activation-policy/layer-mode
 * Responsibility: Re-export canonical layer modes for local activation-policy usage.
 * Primary Inputs: bridges/contracts/layer-mode
 * Primary Outputs: LayerMode helpers
 * Upstream Dependencies: bridges/contracts/layer-mode
 * Downstream Dependencies: activation-policy modules and downstream layers
 * Invariants: Layer modes remain canonical in bridges/contracts.
 * Failure Modes: None
 * Audit Events: none
 * Notes: This file avoids scattered deep import paths from orchestration internals.
 */
export {
  isIntelligentNoopMode,
  isLayerMode,
  LAYER_MODES,
  LAYER_MODE_PRIORITY,
  normalizeLayerMode,
  pickDominantLayerMode,
} from "../../bridges/contracts/layer-mode";
export type { LayerMode } from "../../bridges/contracts/layer-mode";
