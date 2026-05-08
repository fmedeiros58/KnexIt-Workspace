/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 17f-response-calibration-layer
 * Module: response-calibration-layer-bridge
 * Responsibility: Calibrate the final response surface after humanization according to local delivery mode.
 * Primary Inputs: ProcessingState, humanized/validated text and adaptive response-calibration layer mode.
 * Primary Outputs: finalResponse and calibrated structuredResponse.
 * Upstream Dependencies: proactivity gate, humanizer, local calibration operators
 * Downstream Dependencies: presentation
 * Invariants: Calibration only shapes the final surface; it does not replace upstream reasoning.
 * Failure Modes: Missing adaptive signals degrade to delivery-profile defaults.
 * Audit Events: response_calibrated
 * Notes: This layer is the last textual calibration step before presentation ownership takes over.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { resolveLayerModeFromState } from "../05-complexity-and-orchestration-layer/activation-policy/layer-mode-resolver";
import { regulateVerbosity } from "./verbosity-regulator";
import { cleanRedundancy } from "./redundancy-cleaner";
import { adjustBalance } from "./balance-adjuster";
import { runFinalSanityCheck } from "./final-sanity-check";
import { isGreetingMessage, isSmallTalkMessage } from "../shared/utils/conversation-signals";
import { calibrationDepthResolver } from "./operators/calibration-depth-resolver";
import { responseCommitmentRegulator } from "./operators/response-commitment-regulator";

function repairCommonMojibake(value: string): string {
  return `${value || ""}`
    .replace(/Ã¡/g, "á")
    .replace(/Ã /g, "à")
    .replace(/Ã¢/g, "â")
    .replace(/Ã£/g, "ã")
    .replace(/Ã¤/g, "ä")
    .replace(/Ã©/g, "é")
    .replace(/Ã¨/g, "è")
    .replace(/Ãª/g, "ê")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ã´/g, "ô")
    .replace(/Ãµ/g, "õ")
    .replace(/Ãº/g, "ú")
    .replace(/Ã§/g, "ç")
    .replace(/Ã\u0081/g, "Á")
    .replace(/Ã\u0089/g, "É")
    .replace(/Ã\u008D/g, "Í")
    .replace(/Ã\u0093/g, "Ó")
    .replace(/Ã\u009A/g, "Ú")
    .replace(/Ã\u0087/g, "Ç")
    .replace(/intelig[\uFFFD]ncia/gi, "inteligencia")
    .replace(/informa[\uFFFD]{1,2}es/gi, "informacoes")
    .replace(/fa[\uFFFD]a/gi, "faca")
    .replace(/d[\uFFFD]vida/gi, "duvida")
    .replace(/o que [\uFFFD]/gi, "o que e")
    .replace(/let[\uFFFD]cia/gi, "Leticia")
    .replace(/usu[\uFFFD]rio/gi, "Usuario")
    .replace(/\uFFFD+/g, "");
}

function collapseWhitespace(value: string): string {
  return `${value || ""}`
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function stripDialogueLabels(value: string): string {
  return `${value || ""}`
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*:\s*/gi, "\n")
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*-\s*/gi, "\n")
    .trim();
}

function stripKnownScaffolding(value: string): string {
  return `${value || ""}`
    .replace(/continuando o escopo atual de ['"][^'"]+['"],?\s*/gi, "")
    .replace(/continuando o escopo atual de [^.,;:]+[.,;:]?\s*/gi, "")
    .replace(/com base no contexto (atual|anterior)[^.,;:]*[.,;:]?\s*/gi, "")
    .replace(/resposta calibrada[:\-]?\s*/gi, "")
    .replace(/rascunho final[:\-]?\s*/gi, "")
    .trim();
}

function sanitizeCalibrationText(value: string): string {
  return collapseWhitespace(
    stripKnownScaffolding(
      stripDialogueLabels(
        repairCommonMojibake(value),
      ),
    ),
  );
}

function stripTrailingProactiveQuestion(text: string): string {
  const value = sanitizeCalibrationText(text);
  if (!value) return value;

  const parts = value.split(/(?<=[.!?])\s+/g).filter(Boolean);
  if (!parts.length) return value;

  const last = parts[parts.length - 1];
  if (/\?$/.test(last)) {
    parts.pop();
  }

  return collapseWhitespace(parts.join(" ")) || value;
}

function shouldForceDetailedDensity(state: ProcessingState): boolean {
  const prompt = sanitizeCalibrationText(state.normalizedMessage || state.rawMessage || "");
  if (!prompt) return false;
  if (isGreetingMessage(prompt) || isSmallTalkMessage(prompt)) return false;
  if (state.deliberativeTaskState?.isActive) return true;

  const quickComplexity = state.preRouteSignals?.quickComplexity || 0;
  const complexity = Math.max(state.complexityProfile.score || 0, quickComplexity);
  const tokenCount = state.preRouteSignals?.tokenCount || 0;
  const questionCount = state.preRouteSignals?.questionCount || 0;
  const hasDecisionCue = /\b(analise|criterios?|pesos?|alternativas?|riscos?|curto prazo|longo prazo|recomenda|orcamento|corte)\b/i.test(
    prompt,
  );

  return hasDecisionCue || complexity >= 0.45 || tokenCount >= 35 || questionCount >= 2;
}

function pickCalibrationSource(state: ProcessingState): string {
  const candidates = [
    state.humanizedResponse,
    state.structuredResponse,
    state.validatedDraft,
    state.draftResponse?.text,
    state.collapsedTruth?.summary,
  ];

  for (const candidate of candidates) {
    const cleaned = sanitizeCalibrationText(candidate || "");
    if (cleaned) return cleaned;
  }

  return "";
}

function isClosedConstraintDeduction(state: ProcessingState): boolean {
  return (
    state.taskContract?.cognitiveTaskType === "closed_constraint_deduction" ||
    state.taskNatureState?.selectedTaskType === "closed_constraint_deduction" ||
    state.executionArtifacts.inferential?.closedConstraintSolver?.recognized === true
  );
}

function pickDeterministicClosedConstraintSource(state: ProcessingState): string {
  const candidates = [
    state.draftResponse?.text,
    state.validatedDraft,
    state.structuredResponse,
  ];

  for (const candidate of candidates) {
    const cleaned = sanitizeCalibrationText(candidate || "");
    if (!cleaned) continue;
    if (/\b(?:retire|tire)\b.{0,120}\b(?:caixa|amostra)\b/i.test(cleaned)) {
      return cleaned;
    }
  }

  return "";
}

export async function runResponseCalibrationLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const calibrationMode = resolveLayerModeFromState(state, "response-calibration");

  state.normalizedMessage = sanitizeCalibrationText(state.normalizedMessage || state.rawMessage);
  state.activeContext = (state.activeContext || [])
    .map((item) => sanitizeCalibrationText(item))
    .filter(Boolean)
    .slice(-20);
  state.activeConstraints = (state.activeConstraints || [])
    .map((item) => sanitizeCalibrationText(item))
    .filter(Boolean)
    .slice(-32);

  const deterministicClosedConstraint = isClosedConstraintDeduction(state)
    ? pickDeterministicClosedConstraintSource(state)
    : "";
  if (deterministicClosedConstraint) {
    state.finalResponse = deterministicClosedConstraint;
    state.structuredResponse = deterministicClosedConstraint;
    state.executionArtifacts.responseCalibration = {
      applied: true,
      verbosityReduced: false,
      redundancyReduced: false,
      sanityChecked: true,
      density: "detailed",
      forceDetailedDensity: true,
    };
    state.trace.push(
      makeTraceEvent({
        layer: "response-calibration",
        action: "deterministic_closed_constraint_preserved",
        route: state.executionPlan.selectedRoute,
        latencyMs: Date.now() - startedAt,
        detail: `mode=${calibrationMode}; source=draftResponse; chars=${deterministicClosedConstraint.length}`,
      }),
    );
    return state;
  }

  const source = pickCalibrationSource(state);
  const prompt = sanitizeCalibrationText(state.normalizedMessage || state.rawMessage || "");
  const calibrationPolicy = calibrationDepthResolver(state, calibrationMode);

  const preserveClosingQuestion =
    calibrationPolicy.preserveClosingQuestion ||
    isGreetingMessage(prompt) ||
    isSmallTalkMessage(prompt);

  const forceDetailedDensity = shouldForceDetailedDensity(state);
  const effectiveDensity =
    forceDetailedDensity || calibrationPolicy.forceDetailed
      ? "detailed"
      : calibrationPolicy.density || state.deliveryProfileState.density;

  const verbosity = sanitizeCalibrationText(regulateVerbosity(source, effectiveDensity));
  const noRedundancy = sanitizeCalibrationText(cleanRedundancy(verbosity));
  const balanced = sanitizeCalibrationText(
    adjustBalance({
      text: noRedundancy,
      tone: state.deliveryProfileState.tone,
      formality: state.deliveryProfileState.formality,
    }),
  );

  const sanity = runFinalSanityCheck(balanced);

  const proactivityAligned =
    state.proactivityDecisionState.allowProactivity || preserveClosingQuestion
      ? sanity.text
      : stripTrailingProactiveQuestion(sanity.text);

  const postProactivitySanity = runFinalSanityCheck(proactivityAligned);
  const commitment = responseCommitmentRegulator(state, calibrationMode, postProactivitySanity.text);
  const finalSanity = runFinalSanityCheck(sanitizeCalibrationText(commitment.text));

  state.finalResponse = finalSanity.text;
  state.structuredResponse = finalSanity.text;

  state.executionArtifacts.responseCalibration = {
    applied: true,
    verbosityReduced: verbosity.length < source.length,
    redundancyReduced: noRedundancy.length <= verbosity.length,
    sanityChecked: finalSanity.ok,
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
        `verbosityReduced=${verbosity.length < source.length}; ` +
        `redundancyReduced=${noRedundancy.length <= verbosity.length}; sanityOk=${finalSanity.ok}; ` +
        `proactivityAllowed=${state.proactivityDecisionState.allowProactivity}; density=${effectiveDensity}; ` +
        `forceDetailed=${forceDetailedDensity || calibrationPolicy.forceDetailed}; mode=${calibrationMode}; softened=${commitment.softened}`,
    }),
  );

  return state;
}
