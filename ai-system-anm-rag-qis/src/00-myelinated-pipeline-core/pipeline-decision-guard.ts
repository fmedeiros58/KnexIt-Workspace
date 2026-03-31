/**
 * Responsabilidade do arquivo:
 * - Aplicar invariantes globais de decisao para reduzir regressao entre mudancas.
 * - Forcar rota/steps minimos quando o pedido exige verificacao factual.
 * - Registrar rastreabilidade do guard em artifacts, constraints e trace.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import type { PipelineRoute } from "../shared/enums/pipeline-enums";
import { mergeConstraints, toConstraint } from "../shared/state/constraint-utils";
import { makeTraceEvent } from "../shared/utils/trace-utils";

export type DecisionGuardStage = "pre_branch" | "post_orchestration";

export interface DecisionGuardDecision {
  enforced: boolean;
  stage: DecisionGuardStage;
  routeFloor: PipelineRoute;
  requiredSteps: string[];
  reasonTags: string[];
  requiresKnowledge: boolean;
  requiresWeb: boolean;
  followUpDependency: boolean;
  blockedBySafety: boolean;
}

function routeRank(route: PipelineRoute) {
  if (route === "minimum") return 0;
  if (route === "reflective") return 1;
  if (route === "inferential") return 2;
  return 3;
}

function inferLatestDomainAnchor(state: ProcessingState): string {
  const turns = state.recentTurns.slice(-8).map((turn) => `${turn.role}:${turn.content}`.toLowerCase()).reverse();
  for (const turn of turns) {
    if (!turn) continue;
    if (/\bpresidente\b/.test(turn)) return "civic:president";
    if (/\bgovernador\b/.test(turn)) return "civic:governor";
    if (/\bprefeito\b/.test(turn)) return "civic:mayor";
    if (/\b(ceo|capital|cotacao|indice|taxa)\b/.test(turn)) return "factual:entity";
    if (/\b(api|typescript|javascript|python|erro|bug)\b/.test(turn)) return "technical";
  }
  return "";
}

function detectSignals(state: ProcessingState) {
  const text = `${state.normalizedMessage || state.rawMessage || ""}`.trim();
  const lower = text.toLowerCase();
  const snapshot = state.textAnalysisSnapshot;
  const pre = state.preRouteSignals;
  const latestAnchor = inferLatestDomainAnchor(state);
  const greetingFastLaneEligible = Boolean(pre.greetingFastLaneEligible);

  const hasSafetyBlock =
    pre.safetyAction === "caution" ||
    state.inputSignals.safetyFlags.some((flag) => /block|malicious|harmful|prompt_injection/i.test(flag));

  if (greetingFastLaneEligible && !hasSafetyBlock) {
    return {
      text,
      routeFloor: "minimum" as PipelineRoute,
      requiredSteps: [],
      reasonTags: ["greeting_fast_lane_top_gate"],
      requiresKnowledge: false,
      requiresWeb: false,
      followUpDependency: false,
      blockedBySafety: false,
    };
  }

  const hasFactualEntityCue =
    /\b(presidente|governador|prefeito|ceo|capital|cotacao|indice|taxa|mandato|eleit[oa]|posse|data|ano|numero|percentual|lei|norma|resolucao|preco|dose|mg|ml)\b/i.test(
      lower,
    );
  const hasQuestionCue = /\b(quem|qual|quais|quando|onde|what|who|when|where)\b/i.test(lower);
  const hasVerifiableLexicalCue = hasFactualEntityCue || (hasQuestionCue && /\?$/.test(text));

  const hasGenericSourceDemand =
    /\b(fonte|fontes|source|sources|cite|citar|referencia|referencias|verifique|confirmar|confirma)\b/i.test(lower);
  const sourceDemandLooksFactual =
    hasFactualEntityCue ||
    /\b(fato|factual|dado|dados|estatistica|estatisticas|noticia|noticias|paper|papers|artigo|artigos|lei|norma|resolucao|preco|cotacao|taxa|mandato)\b/i.test(
      lower,
    );
  const hasSourceDemand = hasGenericSourceDemand && sourceDemandLooksFactual;
  const hasTemporalCue =
    /\b(hoje|agora|atual|latest|today|recent|recente|recentemente|nesta semana|neste mes|este mes)\b/i.test(lower);
  const hasReferentialCue = /\b(ele|ela|dele|dela|esse|essa|isso|aquele|aquela)\b/i.test(lower);
  const hasFollowUpTimeCue = /\b(quando|when|que ano|em que ano|mandato|eleit[oa]|posse)\b/i.test(lower);

  const followUpDependency =
    hasReferentialCue &&
    hasFollowUpTimeCue &&
    Boolean(latestAnchor || snapshot.hasVerifiableSignal || pre.hasVerifiableSignal);

  const requiresKnowledge =
    hasVerifiableLexicalCue ||
    hasSourceDemand ||
    followUpDependency ||
    snapshot.hasVerifiableSignal ||
    pre.hasVerifiableSignal;

  const requiresWeb =
    hasTemporalCue ||
    snapshot.hasRecencySignal ||
    pre.hasRecencySignal ||
    hasSourceDemand;

  const reasonTags: string[] = [];
  if (hasVerifiableLexicalCue) reasonTags.push("verifiable_lexical_cue");
  if (hasSourceDemand) reasonTags.push("source_demand");
  if (hasTemporalCue || snapshot.hasRecencySignal || pre.hasRecencySignal) reasonTags.push("recency_signal");
  if (followUpDependency) reasonTags.push("followup_dependency");
  if (latestAnchor) reasonTags.push(`anchor:${latestAnchor}`);
  if (hasSafetyBlock) reasonTags.push("safety_block");

  const routeFloor: PipelineRoute =
    requiresKnowledge
      ? (requiresWeb ? "quantum-state" : "inferential")
      : "reflective";

  const requiredSteps = requiresKnowledge
    ? [
        "retrieval",
        "fact_check",
        "evidence_alignment",
        ...(requiresWeb ? ["web_search", "research"] : []),
      ]
    : [];

  return {
    text,
    routeFloor,
    requiredSteps,
    reasonTags,
    requiresKnowledge,
    requiresWeb,
    followUpDependency,
    blockedBySafety: hasSafetyBlock,
  };
}

function toUnique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function applyPipelineDecisionGuard(
  state: ProcessingState,
  stage: DecisionGuardStage,
): DecisionGuardDecision {
  const signals = detectSignals(state);
  let enforced = false;

  if (!signals.blockedBySafety && routeRank(signals.routeFloor) > routeRank(state.executionPlan.selectedRoute)) {
    state.executionPlan.selectedRoute = signals.routeFloor;
    enforced = true;
  }

  if (!signals.blockedBySafety && signals.requiredSteps.length > 0) {
    const current = state.executionPlan.steps || [];
    const merged = toUnique([...current, ...signals.requiredSteps]);
    if (merged.length !== current.length) enforced = true;
    state.executionPlan.steps = merged;
  }

  state.activeConstraints = mergeConstraints(
    state.activeConstraints,
    [
      ...signals.reasonTags.map((tag) => toConstraint("decision_guard", tag)),
      ...(signals.requiresKnowledge ? [toConstraint("decision_guard", "knowledge_required")] : []),
      ...(signals.requiresWeb ? [toConstraint("decision_guard", "web_required")] : []),
      ...(signals.followUpDependency ? [toConstraint("decision_guard", "followup_dependency")] : []),
      ...(enforced ? [toConstraint("decision_guard", "enforced")] : []),
      ...(signals.blockedBySafety ? [toConstraint("decision_guard", "safety_preserved")] : []),
    ],
    40,
  );

  const decision: DecisionGuardDecision = {
    enforced,
    stage,
    routeFloor: signals.routeFloor,
    requiredSteps: signals.requiredSteps,
    reasonTags: signals.reasonTags,
    requiresKnowledge: signals.requiresKnowledge,
    requiresWeb: signals.requiresWeb,
    followUpDependency: signals.followUpDependency,
    blockedBySafety: signals.blockedBySafety,
  };

  state.executionArtifacts = state.executionArtifacts || {
    knowledge: {
      cache: {},
      lastQuerySignature: "",
      lastUsedCache: false,
    },
  };
  state.executionArtifacts.decisionGuard = decision;

  state.trace.push(
    makeTraceEvent({
      layer: "pipeline",
      action: enforced ? "decision_guard_enforced" : "decision_guard_checked",
      route: state.executionPlan.selectedRoute,
      latencyMs: 0,
      detail:
        `stage=${stage}; floor=${signals.routeFloor}; requiresKnowledge=${signals.requiresKnowledge}; ` +
        `requiresWeb=${signals.requiresWeb}; blockedBySafety=${signals.blockedBySafety}; ` +
        `steps=${signals.requiredSteps.join(",") || "none"}`,
    }),
  );

  return decision;
}
