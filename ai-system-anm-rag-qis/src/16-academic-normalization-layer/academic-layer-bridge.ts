import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { citationStyleRouter } from "./citation-style-router";
import { bibliographicNormalizer } from "./bibliographic-normalizer";
import { citationConsistencyValidator } from "./citation-consistency-validator";
import { handoffAcademicToValidation } from "./academic-to-validation-bridge";

export async function runAcademicNormalizationLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
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
