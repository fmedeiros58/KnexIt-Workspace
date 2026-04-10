/**
 * ai-system-anm - bridge 09b
 * Planeja formato de resposta antes do raciocinio/geracao.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { mapResponseIntent } from "./response-intent-mapper";
import { selectResponseStrategy } from "./response-strategy-selector";
import { regulateDepth } from "./depth-regulator";
import { planStructure } from "./structure-planner";

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

function sanitizeResponsePlanningText(value: string): string {
  return collapseWhitespace(stripDialogueLabels(repairCommonMojibake(value)));
}

function sanitizeStringArray(values: string[], limit: number): string[] {
  return (values || [])
    .map((item) => sanitizeResponsePlanningText(item))
    .filter(Boolean)
    .slice(-limit);
}

export async function runResponsePlanningLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();

  state.normalizedMessage = sanitizeResponsePlanningText(state.normalizedMessage || state.rawMessage);
  state.activeConstraints = sanitizeStringArray(state.activeConstraints, 32);
  state.activeContext = sanitizeStringArray(state.activeContext, 20);
  state.retrievedEvidence = sanitizeStringArray(state.retrievedEvidence, 24);

  const text = state.normalizedMessage || sanitizeResponsePlanningText(state.rawMessage);
  const responseIntent = mapResponseIntent(text);

  let strategy = selectResponseStrategy({
    responseIntent,
    ambiguity: state.languageState.ambiguity,
    cautionLevel: state.affectiveState.cautionLevel,
  });

  let depthLevel = regulateDepth({
    complexityScore: state.complexityProfile.score,
    responseIntent,
  });

  let structurePlan = sanitizeStringArray(
    planStructure({ responseIntent, depthLevel }),
    16,
  );

  const deliberative = state.generalTaskDeliberationState || state.deliberativeTaskState;
  if (deliberative?.isActive && deliberative.reasoningContract) {
    strategy = "structured_pass";
    depthLevel = "deep";

    const sectionToPlanToken: Record<string, string> = {
      framing_and_definitions: "premise",
      reasoning_chain_or_proof: "analysis",
      critical_distinctions: "analysis",
      options_or_plan: "comparison",
      tradeoffs_and_impacts: "validation",
      strong_self_objection: "validation",
      reformulation_under_uncertainty: "validation",
      assumption_and_limit_ledger: "validation",
      conclusion: "conclusion",
    };

    const deliberativeStructure = deliberative.reasoningContract.requiredSections
      .map((section) => sectionToPlanToken[section] || "analysis")
      .filter(Boolean);

    if (deliberativeStructure.length > 0) {
      structurePlan = sanitizeStringArray(
        Array.from(new Set(deliberativeStructure)),
        16,
      );
    }
  }

  state.responsePlanState = {
    responseIntent,
    strategy,
    structurePlan,
    depthLevel,
    requiresSynthesis: responseIntent !== "direct",
  };

  state.executionArtifacts.responsePlanning = {
    responseIntent,
    strategy,
    depthLevel,
    structurePlan,
    requiresSynthesis: state.responsePlanState.requiresSynthesis,
  };

  state.executionPlan.steps = Array.from(
    new Set([
      ...state.executionPlan.steps,
      "response_planning",
      `response_intent:${sanitizeResponsePlanningText(responseIntent)}`,
      `response_strategy:${sanitizeResponsePlanningText(strategy)}`,
    ]),
  ).slice(-24);

  state.trace.push(
    makeTraceEvent({
      layer: "response-planning",
      action: "response_plan_built",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `intent=${sanitizeResponsePlanningText(responseIntent)}; ` +
        `strategy=${sanitizeResponsePlanningText(strategy)}; ` +
        `depth=${sanitizeResponsePlanningText(depthLevel)}; ` +
        `structure=${structurePlan.join(",")}`,
    }),
  );

  return state;
}