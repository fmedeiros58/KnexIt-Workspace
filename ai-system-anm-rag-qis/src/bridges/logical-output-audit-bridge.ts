import type { ProcessingState } from "./contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { runLogicalOutputAuditor } from "../cognition/logical-discernment/logical-output-auditor";

export async function runLogicalOutputAuditLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  state.trace.push(
    makeTraceEvent({
      layer: "logical-output-audit",
      action: "logical_output_audit_started",
      route: state.executionPlan.selectedRoute,
      latencyMs: 0,
      detail: "pre_delivery_logical_audit",
    }),
  );

  const source = `${state.finalResponse || state.structuredResponse || state.humanizedResponse || ""}`.trim();
  const audit = runLogicalOutputAuditor({
    frame: state.logicalFrame,
    responseText: source,
  });

  state.logicalAudit = audit;
  state.executionArtifacts = {
    ...state.executionArtifacts,
    logicalOutputAudit: {
      passed: audit.passed,
      score: audit.score,
      issueCount: audit.issues.length,
      repaired: Boolean(audit.repairedResponse),
    },
  };

  if (audit.repairedResponse) {
    state.finalResponse = audit.repairedResponse;
    state.structuredResponse = audit.repairedResponse;
    state.humanizedResponse = audit.repairedResponse;
    state.trace.push(
      makeTraceEvent({
        layer: "logical-output-audit",
        action: "logical_output_repaired",
        route: state.executionPlan.selectedRoute,
        latencyMs: Date.now() - startedAt,
        detail: `issues=${audit.issues.join("|") || "none"}`,
      }),
    );
  } else {
    state.trace.push(
      makeTraceEvent({
        layer: "logical-output-audit",
        action: "logical_output_validated",
        route: state.executionPlan.selectedRoute,
        latencyMs: Date.now() - startedAt,
        detail: `score=${audit.score.toFixed(2)}; issues=${audit.issues.length}`,
      }),
    );
  }

  if (typeof state.confidenceScores.final === "number") {
    state.confidenceScores.final = Math.max(
      0,
      Math.min(1, Number(((state.confidenceScores.final * 0.8) + (audit.score * 0.2)).toFixed(4))),
    );
  }

  return state;
}

