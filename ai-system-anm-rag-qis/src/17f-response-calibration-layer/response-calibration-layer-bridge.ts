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

function shouldForceDetailedDensity(state: ProcessingState): boolean {
  const prompt = `${state.normalizedMessage || state.rawMessage || ""}`.trim();
  if (!prompt) return false;
  if (isGreetingMessage(prompt) || isSmallTalkMessage(prompt)) return false;

  const quickComplexity = state.preRouteSignals?.quickComplexity || 0;
  const complexity = Math.max(state.complexityProfile.score || 0, quickComplexity);
  const tokenCount = state.preRouteSignals?.tokenCount || 0;
  const questionCount = state.preRouteSignals?.questionCount || 0;
  const hasDecisionCue = /\b(analise|criterios?|pesos?|alternativas?|riscos?|curto prazo|longo prazo|recomenda|orcamento|corte)\b/i.test(
    prompt,
  );

  return hasDecisionCue || complexity >= 0.45 || tokenCount >= 35 || questionCount >= 2;
}

export async function runResponseCalibrationLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const source = `${state.humanizedResponse || state.structuredResponse || state.validatedDraft || ""}`;
  const prompt = `${state.normalizedMessage || state.rawMessage || ""}`.trim();
  const preserveClosingQuestion = isGreetingMessage(prompt) || isSmallTalkMessage(prompt);
  const forceDetailedDensity = shouldForceDetailedDensity(state);
  const effectiveDensity = forceDetailedDensity ? "detailed" : state.deliveryProfileState.density;

  const verbosity = regulateVerbosity(source, effectiveDensity);
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
    density: effectiveDensity,
    forceDetailedDensity,
  };

  state.trace.push(
    makeTraceEvent({
      layer: "response-calibration",
      action: "response_calibrated",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `verbosityReduced=${verbosity.length < source.length}; redundancyReduced=${noRedundancy.length <= verbosity.length}; ` +
        `sanityOk=${sanity.ok}; proactivityAllowed=${state.proactivityDecisionState.allowProactivity}; density=${effectiveDensity}; forceDetailed=${forceDetailedDensity}`,
    }),
  );

  return state;
}
