import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { analyzeStructure } from "./structural-analyzer";
import { enforceStructure } from "./structure-enforcer";
import { normalizeStyle } from "./style-normalizer";
import { optimizeReadability } from "./readability-optimizer";
import { controlResponseForm } from "./response-form-controller";
import { polishFinalText } from "./final-text-polisher";
import { handoffStructureToValidation } from "./structure-to-validation-bridge";

export async function runStructureLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const structured = enforceStructure(state.draftResponse.text);
  const styled = normalizeStyle(structured);
  const readable = optimizeReadability(styled);
  const analyzed = analyzeStructure(readable);
  const shaped = controlResponseForm(readable, {
    includeHeading: analyzed.sentenceCount > 2 && !analyzed.hasList,
    heading: "Resposta",
  });

  state.structuredResponse = polishFinalText(shaped);
  state.trace.push(
    makeTraceEvent({
      layer: "structure",
      action: "response_structured",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail: `paragraphs=${analyzed.paragraphs.length}; sentences=${analyzed.sentenceCount}`,
    }),
  );
  return handoffStructureToValidation(state);
}
