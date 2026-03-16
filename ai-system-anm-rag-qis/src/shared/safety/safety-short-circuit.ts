/**
 * Responsabilidade do arquivo:
 * - Resolver decisao de short-circuit de seguranca para fluxo descendente.
 * - Forcar rota minima quando risco elevado for detectado.
 * - Expor motivo explicito para rastreabilidade no trace.
 */
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export interface SafetyShortCircuitDecision {
  shouldShortCircuit: boolean;
  forcedRoute: "minimum" | null;
  reason: string;
}

export function resolveSafetyShortCircuit(state: ProcessingState): SafetyShortCircuitDecision {
  const safetyFlags = state.inputSignals.safetyFlags || [];
  const preRouteSafety = state.preRouteSignals?.safetyAction || "allow";
  const activeConstraints = state.activeConstraints || [];

  const highRisk =
    preRouteSafety === "caution" ||
    safetyFlags.some((flag) => /block|malicious|harmful|prompt_injection/i.test(flag)) ||
    activeConstraints.some((flag) => /safety[:_](block_mode|refuse_high_risk_request)/i.test(flag));

  if (highRisk) {
    return {
      shouldShortCircuit: true,
      forcedRoute: "minimum",
      reason: "high_risk_safety_detected",
    };
  }

  return {
    shouldShortCircuit: false,
    forcedRoute: null,
    reason: "no_safety_short_circuit",
  };
}
