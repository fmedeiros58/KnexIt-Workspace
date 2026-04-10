/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 17b-response-behavior-layer
 * Module: operators/response-behavior-selector
 * Responsibility: Resolve local behavior biases from the current state and adaptive mode.
 * Primary Inputs: ProcessingState and response-behavior layer mode.
 * Primary Outputs: Behavior modulation policy.
 * Upstream Dependencies: bridges/contracts/processing-state, bridges/contracts/layer-mode
 * Downstream Dependencies: response-behavior-layer-bridge
 * Invariants: The selector modulates tone targets only; it never writes semantic content.
 * Failure Modes: Missing adaptive signals degrade to balanced behavior.
 * Audit Events: response_behavior_policy_resolved
 * Notes: This keeps behavior modulation inside layer 17b instead of moving it into orchestration.
 */
import type { LayerMode } from "../../bridges/contracts/layer-mode";
import type { ProcessingState } from "../../bridges/contracts/processing-state";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export interface ResponseBehaviorSelection {
  warmthBias: number;
  empathyBias: number;
  restraintBias: number;
  socialPresenceBias: number;
  humanizationCap: number;
  guidance: string[];
}

export function responseBehaviorSelector(
  state: ProcessingState,
  mode: LayerMode,
): ResponseBehaviorSelection {
  const sensitive = state.affectiveState.cautionLevel >= 0.65;
  const directIntent = state.responsePlanState.responseIntent === "direct";

  if (mode === "delivery-light" || mode === "light") {
    return {
      warmthBias: sensitive ? 0.04 : 0,
      empathyBias: sensitive ? 0.08 : 0.02,
      restraintBias: 0.12,
      socialPresenceBias: -0.04,
      humanizationCap: 0.42,
      guidance: ["behavior_light_mode", "avoid_extra_social_expansion"],
    };
  }

  if (mode === "delivery-rich" || mode === "heavy" || mode === "required") {
    return {
      warmthBias: sensitive ? 0.12 : 0.06,
      empathyBias: sensitive ? 0.14 : 0.08,
      restraintBias: directIntent ? -0.02 : -0.06,
      socialPresenceBias: 0.08,
      humanizationCap: 0.72,
      guidance: ["behavior_rich_mode", "allow_relational_presence"],
    };
  }

  return {
    warmthBias: sensitive ? 0.08 : 0.03,
    empathyBias: sensitive ? 0.1 : 0.04,
    restraintBias: directIntent ? 0.04 : 0,
    socialPresenceBias: clamp01((state.conversationState.rapportScore || 0.5) - 0.5) * 0.12,
    humanizationCap: 0.58,
    guidance: ["behavior_balanced_mode"],
  };
}
