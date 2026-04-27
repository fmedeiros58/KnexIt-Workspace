/**
 * @file academic-layer-bridge.ts
 * @description Aplica normalizacao academica apenas quando a tarefa pede ou tolera fontes e referencias.
 * @layer 16-academic-normalization-layer
 * @purpose Evitar que respostas deterministicas fechadas recebam bibliografia irrelevante ou ruido de citacao.
 * @inputs ProcessingState com resposta estruturada, fontes recuperadas e restricoes ativas.
 * @outputs academicNormalizationState e structuredResponse normalizada quando aplicavel.
 * @dependsOn citation-style-router, bibliographic-normalizer, citation-consistency-validator.
 * @usedBy pipeline-flow-descending.
 * @invariants Tarefas de deducao fechada nao devem ganhar fontes por normalizacao academica.
 * @notes A camada continua no pipeline descendente; o no-op e uma modulacao local por natureza cognitiva.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { citationStyleRouter } from "./citation-style-router";
import { bibliographicNormalizer } from "./bibliographic-normalizer";
import { citationConsistencyValidator } from "./citation-consistency-validator";
import { handoffAcademicToValidation } from "./academic-to-validation-bridge";

export async function runAcademicNormalizationLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const closedConstraintDeduction =
    state.taskContract?.cognitiveTaskType === "closed_constraint_deduction" ||
    state.taskNatureState?.selectedTaskType === "closed_constraint_deduction";

  if (closedConstraintDeduction) {
    state.academicNormalizationState = {
      applied: false,
      style: "none",
      citationCount: 0,
      consistencyNotes: ["academic_normalization_skipped_for_closed_constraint_deduction"],
    };
    state.trace.push(
      makeTraceEvent({
        layer: "academic-normalization",
        action: "academic_normalization_skipped",
        route: state.executionPlan.selectedRoute,
        latencyMs: Date.now() - startedAt,
        detail: "reason=closed_constraint_deduction",
      }),
    );
    return handoffAcademicToValidation(state);
  }

  const style = citationStyleRouter({
    mode: state.selectedMode,
    constraints: state.activeConstraints,
  });
  const normalized = bibliographicNormalizer({
    text: state.structuredResponse,
    style,
    citations: state.retrievedSources.map((item) => item.url),
  });
  const consistency = citationConsistencyValidator({
    style,
    citationCount: normalized.citationCount,
  });

  state.structuredResponse = normalized.text;
  state.academicNormalizationState = {
    applied: style !== "none",
    style,
    citationCount: normalized.citationCount,
    consistencyNotes: consistency.notes,
  };
  state.activeConstraints = [
    ...new Set([
      ...state.activeConstraints,
      ...(consistency.ok ? [] : consistency.notes.map((note) => `academic:${note}`)),
    ]),
  ].slice(-32);

  state.trace.push(
    makeTraceEvent({
      layer: "academic-normalization",
      action: "academic_normalization_applied",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail: `style=${style}; citations=${normalized.citationCount}; ok=${consistency.ok}`,
    }),
  );

  return handoffAcademicToValidation(state);
}
