/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: orchestration-layer-bridge
 * Responsibility: Execute the hybrid orchestration flow: local heuristics, short motor read, fusion, profile selection, activation matrix and adaptive contract construction.
 * Primary Inputs: ProcessingState after context/session consolidation.
 * Primary Outputs: Updated execution plan, motor routing analysis, profile selection result and adaptive pipeline contract.
 * Upstream Dependencies: complexity scorers, mode selectors, request-router, llm-routing, 05b adaptive contract builder
 * Downstream Dependencies: memory layer and the remaining descending pipeline
 * Invariants: The short motor call never produces the final user answer; final generation stays in layer 14.
 * Failure Modes: Motor timeout or schema failure degrade to heuristic fallback without blocking the pipeline.
 * Audit Events: heuristic_scan, motor_routing, fusion_completed, profiles_selected, adaptive_contract_built
 * Notes: This bridge strengthens orchestration without breaking the descending ANM spine.
 */
import type { InteractionMode } from "../shared/enums/mode-enums";
import type { PipelineRoute } from "../shared/enums/pipeline-enums";
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { resolveActiveFamilyIds } from "../shared/families/family-runtime-resolver";
import { buildTextAnalysisSnapshot } from "../shared/text-processing/text-analysis-snapshot";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { mergeConstraints, toConstraint } from "../shared/state/constraint-utils";
import { queryLengthScorer } from "./complexity-evaluator/query-length-scorer";
import { semanticComplexityScorer } from "./complexity-evaluator/semantic-complexity-scorer";
import { ambiguityScorer } from "./complexity-evaluator/ambiguity-scorer";
import { depthRequirementScorer } from "./complexity-evaluator/depth-requirement-scorer";
import { responseBudgetEstimator } from "./complexity-evaluator/response-budget-estimator";
import { chatMode } from "./mode-selector/chat-mode";
import { technicalMode } from "./mode-selector/technical-mode";
import { analysisMode } from "./mode-selector/analysis-mode";
import { writingMode } from "./mode-selector/writing-mode";
import { researchMode } from "./mode-selector/research-mode";
import { summaryMode } from "./mode-selector/summary-mode";
import { teachingMode } from "./mode-selector/teaching-mode";
import {
  isCommunicativeElaborationPrompt,
  isEpistemicAuditPrompt,
  isPhilosophicalSelfModelingPrompt,
  routeRequest,
} from "./request-router";
import { singleStepPlan } from "./plan-builder/single-step-plan";
import { multiStepPlan } from "./plan-builder/multi-step-plan";
import { retrievalAugmentedPlan } from "./plan-builder/retrieval-augmented-plan";
import { mixedReasoningPlan } from "./plan-builder/mixed-reasoning-plan";
import { toolAugmentedPlan } from "./plan-builder/tool-augmented-plan";
import { dependencyResolver } from "./execution-coordinator/dependency-resolver";
import { stepSequencer } from "./execution-coordinator/step-sequencer";
import { timeoutGuard } from "./execution-coordinator/timeout-guard";
import { retryLogic } from "./execution-coordinator/retry-logic";
import { fallbackStrategyManager } from "./execution-coordinator/fallback-strategy-manager";
import { handoffOrchestrationToMemory } from "./orchestration-to-memory-bridge";
import { applyPipelineDecisionGuard } from "../00-myelinated-pipeline-core/pipeline-decision-guard";
import { isConversationalPrompt } from "../shared/utils/conversation-signals";
import { argumentativeDepthDetector } from "../05b-deliberative-task-contract-layer/argumentative-depth-detector";
import { classifyCognitiveDemand } from "../05b-deliberative-task-contract-layer/cognitive-demand-classifier";
import { buildTaskContract } from "../05b-deliberative-task-contract-layer/task-contract-builder";
import { runMotorRoutingClient } from "./llm-routing/motor-routing-client";
import { buildMotorRoutingAuditRecord } from "./llm-routing/motor-routing-audit";
import { fuseMotorAnalysis } from "./llm-routing/motor-analysis-fusion";
import type { HeuristicRoutingSnapshot } from "./llm-routing/routing-analysis-types";
import { selectExecutionProfileIds } from "./execution-profiles/profile-selector";
import { composeExecutionProfiles } from "./execution-profiles/profile-composer";
import { buildLayerActivationMatrix } from "./activation-policy/layer-activation-matrix";
import { summarizeLayerActivations } from "./activation-policy/activation-audit";
import { buildAdaptivePipelineContract } from "../05b-deliberative-task-contract-layer/adaptive-pipeline-contract-builder";
import { recordOrchestratorAudit } from "./orchestrator-audit-recorder";
import { classifyTaskNature } from "./task-nature-classifier";

type TurnRole = "user" | "assistant";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function routeRank(route: PipelineRoute) {
  return route === "minimum" ? 0 : 1;
}

function elevateRoute(current: PipelineRoute, floor: PipelineRoute): PipelineRoute {
  return routeRank(current) >= routeRank(floor) ? current : floor;
}

function toOperationalRoute(route: PipelineRoute): PipelineRoute {
  return route === "minimum" ? "minimum" : "inferential";
}

function countRecentFailures(state: ProcessingState) {
  return state.trace
    .slice(-24)
    .filter((item) => /(fallback|error|retry)/i.test(`${item.action} ${item.detail || ""}`))
    .length;
}

function toUniqueSteps(steps: string[]) {
  return [...new Set(steps)];
}

function hasDirectAnswerCue(text: string) {
  return /\b(curta e grossa|curto e grosso|resposta curta|apenas responda|s[oó] diga|sem explicar|sem analisar|direto ao ponto)\b/i.test(
    `${text || ""}`,
  );
}

function isContinuationRewritePrompt(text: string): boolean {
  return /\b(outra forma|responder de outra forma|reformule|reescreva|mesma pergunta|essa pergunta|essa resposta|isso|mais eficiente|eficiente)\b/i.test(
    `${text || ""}`,
  );
}

function buildTaskNatureClassificationText(state: ProcessingState, currentText: string): string {
  const activeTopic = `${state.conversationState?.activeTopic || ""}`.trim();
  if (!activeTopic || state.conversationState?.topicShiftDetected || !isContinuationRewritePrompt(currentText)) {
    return currentText;
  }

  return `${currentText}\nTopico ativo anterior: ${activeTopic}`;
}

function resolveModeFromAdaptiveSignals(
  currentMode: InteractionMode,
  primaryProfileId: string,
  taskType: string,
): InteractionMode {
  const normalizedTaskType = `${taskType || ""}`.toLowerCase();
  if (primaryProfileId === "technical-implementation-profile" || primaryProfileId === "technical-analysis-profile") {
    return "technical";
  }
  if (primaryProfileId === "architecture-audit-profile" || primaryProfileId === "debug-correction-profile") {
    return "analysis";
  }
  if (primaryProfileId === "research-exploration-profile" || primaryProfileId === "retrieval-augmented-profile") {
    return "research";
  }
  if (primaryProfileId === "teaching-guidance-profile" || primaryProfileId === "pedagogical-explanation-profile") {
    return "teaching";
  }
  if (primaryProfileId === "summary-synthesis-profile") return "summary";
  if (primaryProfileId === "writing-composition-profile") return "writing";
  if (normalizedTaskType.includes("research")) return "research";
  if (normalizedTaskType.includes("implement")) return "technical";
  if (normalizedTaskType.includes("audit") || normalizedTaskType.includes("analysis")) return "analysis";
  return currentMode;
}

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
  return `${value || ""}`.replace(/\s+/g, " ").trim();
}

function stripDialogueLabels(value: string): string {
  return `${value || ""}`
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*:\s*/gi, "\n")
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*-\s*/gi, "\n")
    .trim();
}

function sanitizeOrchestrationText(value: string): string {
  return collapseWhitespace(stripDialogueLabels(repairCommonMojibake(value)));
}

function sanitizeStringArray(values: string[], limit: number): string[] {
  return (values || [])
    .map((item) => sanitizeOrchestrationText(item))
    .filter(Boolean)
    .slice(-limit);
}

function sanitizeRecentTurns(
  turns: Array<{ role: "user" | "assistant"; content: string }>,
  limit = 12,
): Array<{ role: "user" | "assistant"; content: string }> {
  const sanitized: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const turn of turns || []) {
    const role: TurnRole = turn.role === "assistant" ? "assistant" : "user";
    const content = sanitizeOrchestrationText(turn.content);

    if (!content) continue;

    sanitized.push({
      role,
      content,
    });
  }

  return sanitized.slice(-limit);
}

export async function runOrchestrationLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();

  const sanitizedText = sanitizeOrchestrationText(state.normalizedMessage || state.rawMessage);
  const sanitizedRecentTurns = sanitizeRecentTurns(state.recentTurns);
  const sanitizedActiveContext = sanitizeStringArray(state.activeContext, 16);
  const sanitizedActiveConstraints = sanitizeStringArray(state.activeConstraints, 32);

  if (sanitizedText) {
    state.normalizedMessage = sanitizedText;
  }
  state.recentTurns = sanitizedRecentTurns;
  state.activeContext = sanitizedActiveContext;
  state.activeConstraints = sanitizedActiveConstraints;

  const text = state.normalizedMessage || state.rawMessage;
  const snapshot = state.textAnalysisSnapshot ?? buildTextAnalysisSnapshot(text);
  state.textAnalysisSnapshot = snapshot;

  const regulatory = state.memorySnapshot.regulatoryState;
  const nodular = state.memorySnapshot.nodularState;
  const legacyRuntimeTop = state.memorySnapshot.legacyRuntimeTopModules || [];
  const legacyRuntimeMap = state.memorySnapshot.legacyRuntimeModules || {};

  const lengthScore = queryLengthScorer({ snapshot });
  const semanticScore = semanticComplexityScorer({ snapshot });
  const ambiguity = ambiguityScorer({ snapshot });

  const baseComplexityScore = clamp01(
    (lengthScore.score * 0.42) +
      (semanticScore.score * 0.4) +
      (ambiguity.score * 0.18),
  );

  const memoryComplexityBias = clamp01(
    (nodular.attention * 0.32) +
      (nodular.priming * 0.22) +
      (regulatory.stressLoad * 0.18) -
      (regulatory.contextStability * 0.1),
  );

  let complexityScore = clamp01((baseComplexityScore * 0.84) + (memoryComplexityBias * 0.16));

  const conversationalPrompt = isConversationalPrompt(text) || snapshot.hasGreetingSignal;
  const directAnswerCue = hasDirectAnswerCue(text);
  const communicativeElaborationCue = isCommunicativeElaborationPrompt(text);
  const epistemicAuditCue = isEpistemicAuditPrompt(text);
  const philosophicalSelfCue = isPhilosophicalSelfModelingPrompt(text);

  const semanticModes: string[] = [];
  if (communicativeElaborationCue || ["analysis", "writing", "teaching"].includes(state.inputSignals.intent)) {
    semanticModes.push("communicative_elaboration");
  }
  const inferredEpistemicNeed = (snapshot.hasVerifiableSignal || ambiguity.score >= 0.52) && !conversationalPrompt;
  if (epistemicAuditCue || inferredEpistemicNeed) {
    semanticModes.push("epistemic_audit");
  }
  if (philosophicalSelfCue) {
    semanticModes.push("philosophical_self_modeling");
  }

  const hasSemanticRoutingDemand =
    semanticModes.length > 0 ||
    communicativeElaborationCue ||
    epistemicAuditCue ||
    philosophicalSelfCue;

  const hasSafetyRestriction =
    state.preRouteSignals?.safetyAction === "caution" ||
    state.inputSignals.safetyFlags.some((flag) => /block|malicious|prompt_injection|harmful/i.test(flag));

  const greetingFastLaneEligible = Boolean(state.preRouteSignals?.greetingFastLaneEligible);
  const intentGateBypassDeepPipeline = false;
  const logicalFrame = state.logicalFrame;
  const deliberativeDepth = argumentativeDepthDetector(text);
  const demandProfile = classifyCognitiveDemand(text);
  const taskNatureClassificationText = buildTaskNatureClassificationText(state, text);
  const taskNatureState = classifyTaskNature({
    normalizedMessage: taskNatureClassificationText,
    conversationalIntent: state.inputSignals.intent || state.preRouteSignals.quickIntent,
    domain: state.inputSignals.domain,
    hasGreetingSignal: snapshot.hasGreetingSignal,
    hasRetrievalSignal: snapshot.hasVerifiableSignal,
    hasRecencySignal: snapshot.hasRecencySignal,
    sessionSignals: [
      ...(state.conversationState.topicShiftDetected ? ["topic_shift"] : []),
      ...(state.conversationState.needsClarification ? ["needs_clarification"] : []),
    ],
  });
  state.taskNatureState = taskNatureState;
  const localClosedReasoningTask =
    taskNatureState.selectedTaskType === "closed_constraint_deduction" ||
    taskNatureState.selectedTaskType === "short_deterministic_reasoning";
  const logicalRoutingBias = logicalFrame?.shouldAffectRouting ? Math.max(0, logicalFrame.confidence * 0.22) : 0;
  const logicalRetrievalBias = Boolean(logicalFrame?.shouldAffectRetrieval);

  recordOrchestratorAudit(state, {
    stage: "task-nature",
    at: new Date().toISOString(),
    summary: `taskNature=${taskNatureState.selectedTaskType}; confidence=${taskNatureState.confidence.toFixed(2)}`,
    usedMotor: false,
    fallbackUsed: false,
    cacheHit: false,
    details: {
      hypotheses: taskNatureState.hypotheses.map((item) => ({
        taskType: item.taskType,
        score: item.score,
        signals: item.matchedSignals.slice(0, 4),
      })),
      conversationalIntents: taskNatureState.conversationalIntents,
    },
  });

  if (conversationalPrompt && !hasSemanticRoutingDemand) {
    complexityScore = Math.min(complexityScore, 0.28);
  }
  if (!hasSafetyRestriction && !greetingFastLaneEligible && logicalRoutingBias > 0) {
    complexityScore = clamp01(complexityScore + logicalRoutingBias);
  }
  if (!hasSafetyRestriction && !greetingFastLaneEligible && deliberativeDepth.requiresDeliberativeContract) {
    complexityScore = clamp01(Math.max(complexityScore, 0.72));
  }
  if (!hasSafetyRestriction && !greetingFastLaneEligible && demandProfile.requiresDeliberativeContract) {
    complexityScore = clamp01(Math.max(complexityScore, 0.7));
  }
  if (!hasSafetyRestriction && !greetingFastLaneEligible && taskNatureState.requiresStrongValidation) {
    complexityScore = clamp01(Math.max(complexityScore, localClosedReasoningTask ? 0.56 : 0.68));
  }

  const modeCandidates = [
    chatMode({ text, complexityScore, intent: state.inputSignals.intent }),
    technicalMode({ text, complexityScore, intent: state.inputSignals.intent }),
    analysisMode({ text, complexityScore, ambiguityScore: ambiguity.score, intent: state.inputSignals.intent }),
    writingMode({ text, intent: state.inputSignals.intent }),
    researchMode({ text, intent: state.inputSignals.intent }),
    summaryMode({ text, intent: state.inputSignals.intent }),
    teachingMode({ text, intent: state.inputSignals.intent }),
  ];

  let selectedMode = modeCandidates.sort((a, b) => b.score - a.score)[0]?.mode ?? "chat";
  if (conversationalPrompt && !hasSemanticRoutingDemand) {
    selectedMode = "chat";
  }

  const retrievalDemandByIntent = ["research", "analysis", "technical"].includes(state.inputSignals.intent);
  const retrievalDemandBySignal =
    snapshot.hasVerifiableSignal ||
    snapshot.hasRecencySignal ||
    semanticModes.includes("epistemic_audit");

  const provisionalNeedsRetrieval =
    !greetingFastLaneEligible &&
    !hasSafetyRestriction &&
    !directAnswerCue &&
    (
      retrievalDemandByIntent ||
      retrievalDemandBySignal ||
      (!localClosedReasoningTask && deliberativeDepth.requiresDeliberativeContract) ||
      (!localClosedReasoningTask && demandProfile.requiresDeliberativeContract) ||
      logicalRetrievalBias ||
      taskNatureState.requiresRetrieval ||
      (!localClosedReasoningTask && complexityScore >= 0.52)
    );

  const provisionalNeedsWebSearch =
    !greetingFastLaneEligible &&
    !directAnswerCue &&
    (state.inputSignals.intent === "research" || snapshot.hasRecencySignal);

  const provisionalNeedMemoryReinforcement =
    regulatory.stressLoad >= 0.62 ||
    nodular.priming >= 0.58 ||
    legacyRuntimeTop.some((name) => name === "working_memory" || name === "memory_manager");

  const heuristicRiskLevel =
    hasSafetyRestriction || ambiguity.score >= 0.68
      ? "high"
      : ambiguity.score >= 0.42 || snapshot.hasVerifiableSignal
        ? "medium"
        : "low";

  const heuristicValidationNeed =
    hasSafetyRestriction || semanticModes.includes("epistemic_audit")
      ? "heavy"
      : ambiguity.score >= 0.42
        ? "standard"
        : "light";

  const heuristicReflectionNeed =
    philosophicalSelfCue || deliberativeDepth.requiresDeliberativeContract || taskNatureState.requiresCounterposition
      ? "heavy"
      : communicativeElaborationCue || demandProfile.requiresSelfObjection
        ? "standard"
        : "light";

  const heuristicSnapshot: HeuristicRoutingSnapshot = {
    normalizedMessage: text,
    primaryIntent: state.inputSignals.intent || state.preRouteSignals.quickIntent || "chat",
    secondaryIntents: state.preRouteSignals.intentGateSecondaryIntents || [],
    complexityScore,
    ambiguityScore: ambiguity.score,
    selectedMode,
    routeHint: state.executionPlan.selectedRoute,
    domain: state.inputSignals.domain || "general",
    semanticModes,
    hasGreetingSignal: snapshot.hasGreetingSignal,
    hasVerifiableSignal: snapshot.hasVerifiableSignal,
    hasRecencySignal: snapshot.hasRecencySignal,
    needsRetrieval: provisionalNeedsRetrieval,
    needsWebSearch: provisionalNeedsWebSearch,
    needsMemoryReinforcement: provisionalNeedMemoryReinforcement,
    needsClarification: state.conversationState.needsClarification,
    topicShift: state.conversationState.topicShiftDetected,
    responseStyle: conversationalPrompt ? "conversational" : selectedMode,
    expectedOutputShape: conversationalPrompt ? ["paragraph"] : ["structured-answer"],
    riskLevel: heuristicRiskLevel,
    validationNeed: heuristicValidationNeed,
    reflectionNeed: heuristicReflectionNeed,
    proactivityTolerance: conversationalPrompt ? "medium" : "low",
    estimatedBudgetClass: complexityScore >= 0.72 ? "expanded" : complexityScore <= 0.22 ? "tight" : "standard",
  };

  recordOrchestratorAudit(state, {
    stage: "heuristic-scan",
    at: new Date().toISOString(),
    summary: `intent=${heuristicSnapshot.primaryIntent}; complexity=${complexityScore.toFixed(2)}; ambiguity=${ambiguity.score.toFixed(2)}`,
    usedMotor: false,
    fallbackUsed: false,
    cacheHit: false,
    details: {
      semanticModes,
      selectedMode,
      needsRetrieval: provisionalNeedsRetrieval,
      needsMemoryReinforcement: provisionalNeedMemoryReinforcement,
      riskLevel: heuristicRiskLevel,
    },
  });

  const motorRoutingAnalysis = await runMotorRoutingClient({
    normalizedMessage: text,
    recentTurns: sanitizedRecentTurns,
    heuristicSnapshot,
  });

  state.motorRoutingAnalysis = motorRoutingAnalysis;
  recordOrchestratorAudit(state, buildMotorRoutingAuditRecord(motorRoutingAnalysis));

  const fusedDecision = fuseMotorAnalysis(heuristicSnapshot, motorRoutingAnalysis);
  const selectedProfileIds = selectExecutionProfileIds({
    normalizedMessage: text,
    fusedDecision,
    taskNatureState,
  });
  const profileComposition = composeExecutionProfiles(selectedProfileIds, fusedDecision);
  const layerActivations = buildLayerActivationMatrix(
    profileComposition.profiles,
    profileComposition.selection.weights,
  );
  const resolvedLayerModes = summarizeLayerActivations(layerActivations);

  selectedMode = resolveModeFromAdaptiveSignals(
    selectedMode,
    profileComposition.selection.primaryProfileId,
    fusedDecision.taskType,
  );
  complexityScore = fusedDecision.finalComplexityScore;
  state.profileSelectionResult = profileComposition.selection;

  recordOrchestratorAudit(state, {
    stage: "fusion",
    at: new Date().toISOString(),
    summary: `primaryIntent=${fusedDecision.primaryIntent}; complexity=${fusedDecision.finalComplexityBand}; profiles=${profileComposition.selection.selectedProfileIds.join("|")}`,
    usedMotor: fusedDecision.usedMotor,
    fallbackUsed: fusedDecision.fallbackUsed,
    cacheHit: motorRoutingAnalysis.cacheHit,
    details: {
      finalComplexityScore: fusedDecision.finalComplexityScore,
      finalComplexityBand: fusedDecision.finalComplexityBand,
      ambiguityScore: fusedDecision.ambiguityScore,
      dominantSignals: fusedDecision.dominantSignals,
    },
  });

  const depth = depthRequirementScorer({
    complexityScore,
    ambiguityScore: fusedDecision.ambiguityScore,
    intent: fusedDecision.primaryIntent,
  });

  const budget = responseBudgetEstimator({
    complexityScore,
    depthRequired: depth.depthRequired,
    mode: selectedMode,
    argumentativeDepthScore: deliberativeDepth.argumentativeDepthScore,
    reasoningIntensity: demandProfile.reasoningIntensity,
    structuralComplexity: demandProfile.structuralComplexity,
    obligationCount: state.deliberativeTaskState?.obligationGraph?.length || 0,
    requiresFormalization: deliberativeDepth.needsFormalization,
    requiresStructuredCoverage:
      deliberativeDepth.needsStructuredCoverage || demandProfile.requiresStructuredCoverage,
    requiresCounterObjection:
      deliberativeDepth.needsCounterObjection || demandProfile.requiresSelfObjection,
    requiresAssumptionAudit:
      deliberativeDepth.needsAssumptionAudit || demandProfile.requiresAssumptionAudit,
    requiresAlternatives: demandProfile.requiresAlternatives,
    budgetClassHint: fusedDecision.estimatedBudgetClass,
  });
  const taskContract = buildTaskContract({
    state,
    taskNatureState,
    profileSelection: profileComposition.selection,
    responseBudget: budget.responseBudget,
    riskLevel: fusedDecision.riskLevel,
  });
  state.taskContract = taskContract;

  state.complexityProfile.score = complexityScore;
  state.complexityProfile.ambiguity = fusedDecision.ambiguityScore;
  state.complexityProfile.depthRequired = depth.depthRequired;
  state.complexityProfile.responseBudget = budget.responseBudget;
  state.selectedMode = selectedMode;
  state.executionPlan.mode = selectedMode;
  state.executionPlan.maxDepth = depth.depthRequired;

  const routeHint = toOperationalRoute(routeRequest(state));
  const originalRoute = toOperationalRoute(state.executionPlan.selectedRoute);
  const routeElevated = routeRank(routeHint) > routeRank(originalRoute);

  let planningRoute: PipelineRoute = routeElevated ? routeHint : originalRoute;
  let routeFloorReason = "none";
  let semanticRouteFloor: PipelineRoute = "inferential";

  if (semanticModes.includes("epistemic_audit") || semanticModes.includes("philosophical_self_modeling")) {
    semanticRouteFloor = "inferential";
    routeFloorReason = "semantic_inferential_floor";
  } else if (semanticModes.includes("communicative_elaboration")) {
    routeFloorReason = "semantic_inferential_floor";
  }

  if (
    conversationalPrompt &&
    !hasSemanticRoutingDemand &&
    !hasSafetyRestriction &&
    !greetingFastLaneEligible
  ) {
    planningRoute = elevateRoute(planningRoute, "inferential");
    routeFloorReason = "conversation_inferential_floor";
  }

  if (!hasSafetyRestriction && !greetingFastLaneEligible) {
    planningRoute = elevateRoute(planningRoute, semanticRouteFloor);
  }
  if (!hasSafetyRestriction && !greetingFastLaneEligible && logicalFrame?.shouldAffectRouting) {
    planningRoute = elevateRoute(planningRoute, "inferential");
    routeFloorReason = "logical_discernment_floor";
  }
  if (
    !hasSafetyRestriction &&
    !greetingFastLaneEligible &&
    (deliberativeDepth.requiresDeliberativeContract || demandProfile.requiresDeliberativeContract)
  ) {
    planningRoute = "inferential";
    routeFloorReason = "deliberative_contract_floor";
  }

  if (regulatory.blockStructuralConsolidation && planningRoute !== "minimum") {
    planningRoute = "inferential";
    routeFloorReason = "regulatory_deep_floor";
  }

  if (
    legacyRuntimeTop.some((name) => name.includes("modular_") || name.includes("global_")) &&
    planningRoute === "minimum" &&
    complexityScore >= 0.33
  ) {
    planningRoute = "inferential";
    routeFloorReason = "legacy_deep_floor";
  }

  if (
    !hasSafetyRestriction &&
    planningRoute === "minimum" &&
    !greetingFastLaneEligible
  ) {
    planningRoute = "inferential";
    routeFloorReason = "minimum_disabled_deep_default_floor";
  }

  if (greetingFastLaneEligible && !hasSafetyRestriction) {
    planningRoute = "minimum";
    routeFloorReason = "greeting_fast_lane_top_gate";
  } else if (!hasSafetyRestriction) {
    planningRoute = "inferential";
    routeFloorReason = routeFloorReason === "none" ? "non_greeting_deep_default" : routeFloorReason;
  }

  planningRoute = toOperationalRoute(planningRoute);

  const needRetrieval =
    !greetingFastLaneEligible &&
    !intentGateBypassDeepPipeline &&
    !hasSafetyRestriction &&
    !directAnswerCue &&
    (
      provisionalNeedsRetrieval ||
      fusedDecision.retrievalNeed === "standard" ||
      fusedDecision.retrievalNeed === "heavy"
    );

  const needWebSearch =
    !greetingFastLaneEligible &&
    !intentGateBypassDeepPipeline &&
    !directAnswerCue &&
    (
      provisionalNeedsWebSearch ||
      fusedDecision.retrievalNeed === "heavy"
    );

  const needMemoryReinforcement =
    provisionalNeedMemoryReinforcement ||
    fusedDecision.memoryNeed === "heavy";

  const singlePlan = singleStepPlan({ route: planningRoute, mode: selectedMode });
  const multiPlan = multiStepPlan({
    baseSteps: singlePlan.steps,
    depthRequired: depth.depthRequired,
  });
  const retrievalPlan = retrievalAugmentedPlan({
    steps: multiPlan.steps,
    needRetrieval,
  });
  const reasoningPlan = mixedReasoningPlan({
    steps: retrievalPlan.steps,
    route: planningRoute,
  });
  const toolPlan = toolAugmentedPlan({
    steps: needMemoryReinforcement
      ? [...reasoningPlan.steps, "memory_reinforcement"]
      : reasoningPlan.steps,
    mode: selectedMode,
    needWebSearch,
  });

  const semanticAugmentedSteps = [
    ...toolPlan.steps,
    ...(semanticModes.includes("communicative_elaboration") ? ["communicative_elaboration"] : []),
    ...(semanticModes.includes("epistemic_audit") ? ["epistemic_audit"] : []),
    ...(semanticModes.includes("philosophical_self_modeling") ? ["philosophical_self_modeling"] : []),
  ];

  const resolved = dependencyResolver({ steps: toolPlan.steps });
  resolved.resolvedSteps = Array.from(new Set([...resolved.resolvedSteps, ...semanticAugmentedSteps]));

  const sequenced = stepSequencer({
    resolvedSteps: resolved.resolvedSteps,
    maxDepth: depth.depthRequired,
  });

  const timeout = timeoutGuard({
    route: planningRoute,
    complexityScore,
  });

  const retry = retryLogic({
    route: planningRoute,
    complexityScore,
    urgency: state.inputSignals.urgency,
    priorFailureCount: countRecentFailures(state),
  });

  const fallback = fallbackStrategyManager({
    route: planningRoute,
    mode: selectedMode,
    complexityScore,
    ambiguity: ambiguity.score,
    safetyFlags: state.inputSignals.safetyFlags,
    hasSources: (state.retrievedSources.length + state.retrievedEvidence.length) > 0,
  });

  state.executionPlan.selectedRoute = planningRoute;
  state.executionPlan.steps = toUniqueSteps(sequenced.sequencedSteps);
  state.executionPlan.timeoutMs = timeout.timeoutMs;
  state.executionPlan.retryMaxAttempts = retry.maxAttempts;
  state.executionPlan.fallbackStrategy = fallback.primaryStrategy;

  const guardDecision = applyPipelineDecisionGuard(state, "post_orchestration");
  planningRoute = state.executionPlan.selectedRoute;

  const adaptivePipelineContract = buildAdaptivePipelineContract({
    state,
    fusedDecision,
    selectedProfiles: profileComposition.profiles,
    profileSelection: profileComposition.selection,
    layerActivations,
    responseBudget: budget.responseBudget,
    taskNatureState,
    taskContract,
  });
  state.adaptivePipelineContract = adaptivePipelineContract;

  recordOrchestratorAudit(state, {
    stage: "profile-selection",
    at: new Date().toISOString(),
    summary: `primaryProfile=${profileComposition.selection.primaryProfileId}; selected=${profileComposition.selection.selectedProfileIds.join("|")}`,
    usedMotor: fusedDecision.usedMotor,
    fallbackUsed: fusedDecision.fallbackUsed,
    cacheHit: motorRoutingAnalysis.cacheHit,
    details: {
      weights: profileComposition.selection.weights,
      dominantSignals: profileComposition.selection.dominantSignals,
    },
  });

  recordOrchestratorAudit(state, {
    stage: "layer-activation",
    at: new Date().toISOString(),
    summary: `resolvedLayers=${Object.keys(resolvedLayerModes).length}; primaryProfile=${profileComposition.selection.primaryProfileId}`,
    usedMotor: fusedDecision.usedMotor,
    fallbackUsed: fusedDecision.fallbackUsed,
    cacheHit: motorRoutingAnalysis.cacheHit,
    details: resolvedLayerModes,
  });

  recordOrchestratorAudit(state, {
    stage: "adaptive-contract",
    at: new Date().toISOString(),
    summary: `contract=${adaptivePipelineContract.version}; budget=${adaptivePipelineContract.responseBudget}; risk=${adaptivePipelineContract.riskLevel}`,
    usedMotor: fusedDecision.usedMotor,
    fallbackUsed: fusedDecision.fallbackUsed,
    cacheHit: motorRoutingAnalysis.cacheHit,
    details: {
      selectedProfiles: adaptivePipelineContract.selectedProfiles.selectedProfileIds,
      budgetClass: adaptivePipelineContract.budgetClass,
      responsePolicy: adaptivePipelineContract.responsePolicy,
    },
  });

  state.activeConstraints = mergeConstraints(
    state.activeConstraints,
    [
      ...(routeElevated ? [toConstraint("route_hint", routeHint)] : []),
      ...semanticModes.map((mode) => toConstraint("semantic_mode", mode)),
      ...(routeFloorReason !== "none" ? [toConstraint("route_floor", routeFloorReason)] : []),
      ...(greetingFastLaneEligible ? [toConstraint("fast_lane", "greeting_top_gate")] : []),
      ...(intentGateBypassDeepPipeline ? [toConstraint("fast_lane", "intent_gate_top_gate")] : []),
      ...(guardDecision.enforced ? [toConstraint("decision_guard", "enforced_post_orchestration")] : []),
      ...(logicalFrame ? [toConstraint("logical_principle", logicalFrame.dominantPrinciple)] : []),
      ...(logicalFrame?.recommendedAction ? [toConstraint("logical_recommended_action", "present")] : []),
      ...(deliberativeDepth.requiresDeliberativeContract
        ? [
            toConstraint("deliberative_contract", "active"),
            toConstraint("deliberative_depth", deliberativeDepth.argumentativeDepthScore.toFixed(2)),
            ...(deliberativeDepth.needsFormalization ? [toConstraint("deliberative_formalization", "required")] : []),
          ]
        : []),
      ...(demandProfile.requiresDeliberativeContract
        ? [
            toConstraint("task_deliberation", "active"),
            toConstraint("task_reasoning_intensity", demandProfile.reasoningIntensity.toFixed(2)),
            toConstraint("task_structural_complexity", demandProfile.structuralComplexity.toFixed(2)),
          ]
        : []),
      toConstraint("adaptive_profile", profileComposition.selection.primaryProfileId),
      toConstraint("task_nature", taskNatureState.selectedTaskType),
      toConstraint("task_contract", taskContract.version),
      toConstraint("adaptive_budget_class", fusedDecision.estimatedBudgetClass),
      ...(fusedDecision.needsClarification ? [toConstraint("adaptive_clarification", "required")] : []),
      toConstraint("fallback", fallback.primaryStrategy),
      toConstraint("retry_max_attempts", `${retry.maxAttempts}`),
      ...(needMemoryReinforcement ? [toConstraint("memory", "reinforcement_required")] : []),
      ...(regulatory.blockStructuralConsolidation ? [toConstraint("memory", "regulatory_gate_active")] : []),
      ...(nodular.attention >= 0.68 ? [toConstraint("nodular", "attention_priority")] : []),
      ...(legacyRuntimeTop.length ? [toConstraint("legacy_runtime_top", legacyRuntimeTop.slice(0, 2).join(","))] : []),
      ...fallback.guardrails.map((item) => toConstraint("guardrail", item)),
    ],
    32,
  );

  state.timings.orchestrationTimeoutMs = timeout.timeoutMs;
  state.timings.orchestrationRetryBackoffMs = retry.backoffMs;
  state.executionArtifacts =
    state.executionArtifacts || { knowledge: { cache: {}, lastQuerySignature: "", lastUsedCache: false } };
  state.executionArtifacts.activeFamilies = resolveActiveFamilyIds(state);

  state.executionArtifacts.orchestration = {
    selectedMode,
    planningRoute,
    routeHint,
    semanticModes,
    complexityScore,
    ambiguityScore: fusedDecision.ambiguityScore,
    needRetrieval,
    needWebSearch,
    needMemoryReinforcement,
    timeoutMs: timeout.timeoutMs,
    retryMaxAttempts: retry.maxAttempts,
    fallbackStrategy: fallback.primaryStrategy,
    steps: [...state.executionPlan.steps],
    activeFamilies: [...state.executionArtifacts.activeFamilies],
    motorRoutingUsed: fusedDecision.usedMotor,
    motorRoutingCacheHit: motorRoutingAnalysis.cacheHit,
    motorRoutingFallbackUsed: fusedDecision.fallbackUsed,
    recommendedProfiles: [...profileComposition.selection.selectedProfileIds],
    resolvedLayerModes,
    adaptiveContractVersion: adaptivePipelineContract.version,
    budgetClass: fusedDecision.estimatedBudgetClass,
    selectedTaskType: taskNatureState.selectedTaskType,
    taskNatureConfidence: taskNatureState.confidence,
    taskContractVersion: taskContract.version,
  };

  state.trace.push(
    makeTraceEvent({
      layer: "orchestration",
      action: "orchestration_planned",
      route: planningRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `score=${complexityScore.toFixed(3)}; ambiguity=${fusedDecision.ambiguityScore.toFixed(3)}; mode=${selectedMode}; routeHint=${routeHint}; ` +
        `planRoute=${planningRoute}; semanticModes=${semanticModes.join(",") || "none"}; steps=${state.executionPlan.steps.length}; fallback=${fallback.primaryStrategy}; retry=${retry.maxAttempts}; ` +
        `greetingFastLaneEligible=${greetingFastLaneEligible}; intentGateBypass=${intentGateBypassDeepPipeline}; ` +
        `logicalPrinciple=${logicalFrame?.dominantPrinciple || "none"}; logicalAffectRouting=${logicalFrame?.shouldAffectRouting ? "true" : "false"}; ` +
        `logicalAffectRetrieval=${logicalFrame?.shouldAffectRetrieval ? "true" : "false"}; ` +
        `deliberativeActive=${deliberativeDepth.requiresDeliberativeContract ? "true" : "false"}; deliberativeScore=${deliberativeDepth.argumentativeDepthScore.toFixed(2)}; ` +
        `taskDeliberation=${demandProfile.requiresDeliberativeContract ? "true" : "false"}; reasoningIntensity=${demandProfile.reasoningIntensity.toFixed(2)}; structuralComplexity=${demandProfile.structuralComplexity.toFixed(2)}; ` +
        `taskNature=${taskNatureState.selectedTaskType}; taskNatureConfidence=${taskNatureState.confidence.toFixed(2)}; taskContract=${taskContract.version}; ` +
        `adaptivePrimaryIntent=${fusedDecision.primaryIntent}; adaptiveProfiles=${profileComposition.selection.selectedProfileIds.join("|") || "none"}; budgetClass=${fusedDecision.estimatedBudgetClass}; ` +
        `tokens=${snapshot.tokenCount}; sentences=${snapshot.sentenceCount}; verifiable=${snapshot.hasVerifiableSignal}; recency=${snapshot.hasRecencySignal}; ` +
        `memoryBias=${memoryComplexityBias.toFixed(2)}; stress=${regulatory.stressLoad.toFixed(2)}; nodularAttention=${nodular.attention.toFixed(2)}; ` +
        `legacyTop=${legacyRuntimeTop.slice(0, 2).join(",")}; memoryManager=${(legacyRuntimeMap.memory_manager || 0).toFixed(2)}`,
    }),
  );

  return handoffOrchestrationToMemory(state);
}
