/** ai-system-anm - bridge 17f */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { regulateVerbosity } from "./verbosity-regulator";
import { cleanRedundancy } from "./redundancy-cleaner";
import { adjustBalance } from "./balance-adjuster";
import { runFinalSanityCheck } from "./final-sanity-check";
import { isGreetingMessage, isSmallTalkMessage } from "../shared/utils/conversation-signals";

function stripTrailingProactiveQuestion(text: string): string {
  const value = `${text || ""}`.trim();
  if (!value) return value;
  const parts = value.split(/(?<=[.!?])\s+/g).filter(Boolean);
  if (!parts.length) return value;
  const last = parts[parts.length - 1];
  if (/\?$/.test(last)) {
    parts.pop();
  }
  return parts.join(" ").trim() || value;
}

export async function runResponseCalibrationLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const source = `${state.humanizedResponse || state.structuredResponse || state.validatedDraft || ""}`;
  const prompt = `${state.normalizedMessage || state.rawMessage || ""}`.trim();
  const preserveClosingQuestion = isGreetingMessage(prompt) || isSmallTalkMessage(prompt);

  const verbosity = regulateVerbosity(source, state.deliveryProfileState.density);
  const noRedundancy = cleanRedundancy(verbosity);
  const balanced = adjustBalance({
    text: noRedundancy,
    tone: state.deliveryProfileState.tone,
    formality: state.deliveryProfileState.formality,
  });
  const sanity = runFinalSanityCheck(balanced);
  const proactivityAligned = state.proactivityDecisionState.allowProactivity || preserveClosingQuestion
    ? sanity.text
    : stripTrailingProactiveQuestion(sanity.text);

  state.finalResponse = proactivityAligned;
  state.structuredResponse = proactivityAligned;

  state.executionArtifacts.responseCalibration = {
    applied: true,
    verbosityReduced: verbosity.length < source.length,
    redundancyReduced: noRedundancy.length <= verbosity.length,
    sanityChecked: sanity.ok,
  };

  state.trace.push(
    makeTraceEvent({
      layer: "response-calibration",
      action: "response_calibrated",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `verbosityReduced=${verbosity.length < source.length}; redundancyReduced=${noRedundancy.length <= verbosity.length}; ` +
        `sanityOk=${sanity.ok}; proactivityAllowed=${state.proactivityDecisionState.allowProactivity}`,
    }),
  );

  return state;
}
