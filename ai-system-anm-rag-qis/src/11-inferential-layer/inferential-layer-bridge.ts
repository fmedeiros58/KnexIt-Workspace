/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 11-inferential-layer
 * Module: inferential-layer-bridge
 * Responsibility: Execute inferential analysis and apply local inferential operators before metacognitive handoff.
 * Primary Inputs: ProcessingState, inferential mode and local inferential operators.
 * Primary Outputs: Updated inferential map, inferential execution artifacts and metacognitive handoff.
 * Upstream Dependencies: reflective layer, communicative elaboration, local inferential operators
 * Downstream Dependencies: metacognitive layer
 * Invariants: Inferential expansion stays local and does not replace validation or final generation.
 * Failure Modes: Sparse hypotheses degrade to lighter inferential maps.
 * Audit Events: inferential_map_built, inferential_low_signal
 * Notes: Local depth and hypothesis operators make scenario expansion explicit instead of implicit.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { resolveLayerModeFromState } from "../05-complexity-and-orchestration-layer/activation-policy/layer-mode-resolver";
import { mergeConstraints, toConstraint } from "../shared/state/constraint-utils";
import { runInferenceEngine } from "./inferential-core/inference-engine";
import { inferentialHandoff } from "./inferential-output-core/inferential-handoff";
import { handoffInferentialToMetacognitive } from "./inferential-to-metacognitive-bridge";
import { runCommunicativeElaborationBridge } from "../bridges/communicative-elaboration.bridge";
import { runPhilosophicalSelfModelingBridgeAdapter } from "../bridges/philosophical-self-modeling.bridge";
import { inferenceDepthResolver } from "./operators/inference-depth-resolver";
import { hypothesisExpander } from "./operators/hypothesis-expander";
import { solveClosedConstraintDeduction } from "./operators/closed-constraint-solver";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
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

function sanitizeInferentialText(value: string): string {
  return collapseWhitespace(stripDialogueLabels(repairCommonMojibake(value)));
}

function sanitizeStringArray(values: string[], limit: number): string[] {
  return (values || [])
    .map((item) => sanitizeInferentialText(item))
    .filter(Boolean)
    .slice(0, limit);
}

export async function runInferentialLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const inferentialMode = resolveLayerModeFromState(state, "inferential");

  state.normalizedMessage = sanitizeInferentialText(state.normalizedMessage || state.rawMessage);
  state.activeContext = sanitizeStringArray(state.activeContext, 20);
  state.activeConstraints = sanitizeStringArray(state.activeConstraints, 32);
  state.retrievedEvidence = sanitizeStringArray(state.retrievedEvidence, 24);
  state.criticalCaveats = sanitizeStringArray(state.criticalCaveats, 16);

  if (!state.communicativeElaborationState) {
    await runCommunicativeElaborationBridge(state);
  }
  if (!state.philosophicalSelfModelState) {
    await runPhilosophicalSelfModelingBridgeAdapter(state);
  }

  const inferentialMap = runInferenceEngine(state);
  const inferenceDepth = inferenceDepthResolver(state, inferentialMode);
  const expandedHypotheses = sanitizeStringArray(hypothesisExpander(state, inferentialMode), 16);
  const closedConstraintSolver =
    state.taskContract?.cognitiveTaskType === "closed_constraint_deduction"
      ? solveClosedConstraintDeduction({ prompt: state.rawMessage || state.normalizedMessage })
      : null;
  const closedConstraintImplications = closedConstraintSolver?.recognized
    ? [
        `deducao_fechada_acao:${sanitizeInferentialText(closedConstraintSolver.action || "")}`,
        ...closedConstraintSolver.steps.map((step) => `deducao_fechada_passo:${sanitizeInferentialText(step)}`),
        ...closedConstraintSolver.conclusions.map((conclusion) => `deducao_fechada_conclusao:${sanitizeInferentialText(conclusion)}`),
      ]
    : [];
  const logicalFrame = state.logicalFrame;
  const deliberative = state.deliberativeTaskState;
  const communicativeBranches = state.communicativeElaborationState?.hypothesisBranches || [];
  const ontologicalHooks = state.philosophicalSelfModelState?.ontologyStatements || [];

  const enrichedInferentialMap = {
    implications: [
      ...closedConstraintImplications,
      ...sanitizeStringArray(inferentialMap.implications, 18),
      ...expandedHypotheses.map((item) => `hipotese_expandida:${sanitizeInferentialText(item)}`),
      ...communicativeBranches
        .map((row) => `implicacao_da_hipotese:${sanitizeInferentialText(row.claim)}`)
        .slice(0, 4),
      ...(logicalFrame?.feasibleActions.length
        ? logicalFrame.feasibleActions.slice(0, 3).map((action) =>
            `acao_viavel:${sanitizeInferentialText(action.label)} (custo_marginal=${(action.estimatedMarginalCost ?? 0.5).toFixed(2)})`,
          )
        : []),
      ...(ontologicalHooks.length > 0
        ? [
            `enquadramento_ontologico:${sanitizeInferentialText(
              ontologicalHooks.slice(0, 2).map((row) => row.claim).join(" | "),
            )}`,
          ]
        : []),
      ...(deliberative?.isActive
        ? [
            ...deliberative.solutionModels
              .slice(0, 3)
              .map(
                (model) =>
                  `modelo:${sanitizeInferentialText(model.title)}; risco_logico=${sanitizeInferentialText(model.logicalRisk)}; risco_institucional=${sanitizeInferentialText(model.institutionalRisk)}`,
              ),
            ...(deliberative.proofSkeleton?.proofSteps || [])
              .slice(0, 3)
              .map((step) => `prova:${sanitizeInferentialText(step)}`),
          ]
        : []),
    ].slice(0, 18),
    scenarios: [
      ...sanitizeStringArray(inferentialMap.scenarios, 12),
      ...(logicalFrame?.recommendedAction
        ? [`cenario_recomendado:${sanitizeInferentialText(logicalFrame.recommendedAction)}`]
        : []),
      ...(deliberative?.isActive
        ? deliberative.solutionModels
            .slice(0, 2)
            .map(
              (model) =>
                `cenario_${sanitizeInferentialText(model.id)}:${sanitizeInferentialText(model.operationalMechanism)}`,
            )
        : []),
    ].slice(0, 12),
    secondOrderEffects: sanitizeStringArray(inferentialMap.secondOrderEffects, 16),
  };

  const nodular = state.memorySnapshot.nodularState;
  const regulatory = state.memorySnapshot.regulatoryState;
  const runtimeTop = state.memorySnapshot.legacyRuntimeTopModules || [];

  const handoff = inferentialHandoff({
    text: [
      ...enrichedInferentialMap.implications,
      ...enrichedInferentialMap.scenarios,
      ...enrichedInferentialMap.secondOrderEffects,
    ].join(" "),
    score: clamp01(
      (enrichedInferentialMap.implications.length * 0.09) +
        (enrichedInferentialMap.scenarios.length * 0.07) +
        (inferenceDepth === "heavy" ? 0.08 : inferenceDepth === "medium" ? 0.04 : 0) +
        (nodular.priming * 0.08) -
        (regulatory.stressLoad * 0.06),
    ),
  });

  const lowSignal = handoff.score < 0.34;

  if (!lowSignal) {
    state.inferentialMap = {
      implications: [...enrichedInferentialMap.implications],
      scenarios: [...enrichedInferentialMap.scenarios],
      secondOrderEffects: [...enrichedInferentialMap.secondOrderEffects],
    };
    state.scenarioSet = [...enrichedInferentialMap.scenarios];

    state.confidenceScores.final = Number(
      clamp01((state.confidenceScores.final * 0.75) + (handoff.score * 0.25)).toFixed(4),
    );
  }

  state.executionArtifacts.inferential = {
    familyId: "inferential_projection",
    lowSignal,
    score: handoff.score,
    mode: inferentialMode,
    depth: inferenceDepth,
    implicationsCount: enrichedInferentialMap.implications.length,
    scenariosCount: enrichedInferentialMap.scenarios.length,
    secondOrderCount: enrichedInferentialMap.secondOrderEffects.length,
    expandedHypothesisCount: expandedHypotheses.length,
    communicativeHypothesisCount: communicativeBranches.length,
    ontologicalHooksCount: ontologicalHooks.length,
    closedConstraintSolver: closedConstraintSolver
      ? {
          recognized: closedConstraintSolver.recognized,
          pattern: closedConstraintSolver.pattern,
          confidence: closedConstraintSolver.confidence,
          action: closedConstraintSolver.action,
          issues: closedConstraintSolver.issues,
        }
      : undefined,
  };

  state.activeConstraints = mergeConstraints(
    state.activeConstraints,
    [
      ...(lowSignal ? [toConstraint("inferential", "low_signal")] : []),
      ...(enrichedInferentialMap.secondOrderEffects.length
        ? [toConstraint("inferential", "second_order_active")]
        : []),
      ...(communicativeBranches.length
        ? [toConstraint("inferential", "communicative_hypothesis_hooks")]
        : []),
      ...(expandedHypotheses.length
        ? [toConstraint("inferential", "hypothesis_expansion_active")]
        : []),
      ...(closedConstraintSolver?.recognized
        ? [toConstraint("inferential", "closed_constraint_solver_active")]
        : []),
      ...(ontologicalHooks.length
        ? [toConstraint("inferential", "ontological_framing_hooks")]
        : []),
      ...(nodular.priming >= 0.62 ? [toConstraint("inferential", "nodular_priming_high")] : []),
      ...(regulatory.stressLoad >= 0.7 ? [toConstraint("inferential", "regulatory_caution")] : []),
      ...(runtimeTop.length
        ? [toConstraint("inferential_runtime_top", runtimeTop.slice(0, 2).join(","))]
        : []),
    ],
    32,
  );

  state.trace.push(
    makeTraceEvent({
      layer: "inferential",
      action: lowSignal ? "inferential_low_signal" : "inferential_map_built",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `mode=${inferentialMode}; depth=${inferenceDepth}; implications=${enrichedInferentialMap.implications.length}; scenarios=${enrichedInferentialMap.scenarios.length}; secondOrder=${enrichedInferentialMap.secondOrderEffects.length}; ` +
        `expandedHypotheses=${expandedHypotheses.length}; commBranches=${communicativeBranches.length}; ontoHooks=${ontologicalHooks.length}; ` +
        `closedConstraintSolver=${closedConstraintSolver?.recognized ? "active" : "inactive"}; handoff=${handoff.score.toFixed(2)}; priming=${nodular.priming.toFixed(2)}; stress=${regulatory.stressLoad.toFixed(2)}; runtimeTop=${runtimeTop.slice(0, 2).join(",")}`,
    }),
  );

  return handoffInferentialToMetacognitive(state);
}
