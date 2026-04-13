import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { problemStructurer } from "./problem-modeling-core/problem-structurer";
import { reasoningPlanBuilder } from "./cognitive-planning-core/reasoning-plan-builder";
import { preparatoryAmbiguityDetector } from "./ambiguity-resolution-support-core/ambiguity-detector";
import { salienceDetector } from "./cognitive-salience-core/salience-detector";
import { handoffPreparatoryToReflective } from "./preparatory-to-reflective-bridge";

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

function sanitizePreparatoryText(value: string): string {
  return collapseWhitespace(stripDialogueLabels(repairCommonMojibake(value)));
}

function sanitizeStringArray(values: string[], limit: number): string[] {
  return (values || [])
    .map((item) => sanitizePreparatoryText(item))
    .filter(Boolean)
    .slice(-limit);
}

export async function runPreparatoryCognitiveLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();

  state.normalizedMessage = sanitizePreparatoryText(state.normalizedMessage || state.rawMessage);
  state.activeConstraints = sanitizeStringArray(state.activeConstraints, 32);
  state.activeContext = sanitizeStringArray(state.activeContext, 20);
  state.retrievedEvidence = sanitizeStringArray(state.retrievedEvidence, 24);

  const text = state.normalizedMessage || sanitizePreparatoryText(state.rawMessage);

  const problem = problemStructurer({ text });
  const ambiguity = preparatoryAmbiguityDetector({
    text,
    baselineAmbiguity: state.complexityProfile.ambiguity,
  });
  const salience = salienceDetector({ text });
  const plan = reasoningPlanBuilder({
    goal: sanitizePreparatoryText(problem.goal),
    route: state.executionPlan.selectedRoute,
    ambiguity: ambiguity.ambiguityScore,
  });

  const sanitizedProblemConstraints = sanitizeStringArray(problem.constraints, 16);
  const sanitizedAmbiguityFlags = sanitizeStringArray(ambiguity.ambiguityFlags, 12);
  const sanitizedSalientTerms = sanitizeStringArray(salience.salientTerms, 16);
  const sanitizedPlanSteps = sanitizeStringArray(plan.steps, 24);

  state.preparatoryState = {
    goal: sanitizePreparatoryText(problem.goal),
    constraints: sanitizedProblemConstraints,
    ambiguityScore: ambiguity.ambiguityScore,
    ambiguityFlags: sanitizedAmbiguityFlags,
    salientTerms: sanitizedSalientTerms,
    cognitivePlan: sanitizedPlanSteps,
  };

  state.activeConstraints = [
    ...new Set([
      ...state.activeConstraints,
      ...sanitizedProblemConstraints,
      ...sanitizedAmbiguityFlags.map((flag) => `preparatory:${flag}`),
    ]),
  ].slice(-28);

  state.executionPlan.steps = [
    ...new Set([
      ...state.executionPlan.steps,
      ...sanitizedPlanSteps,
    ]),
  ];

  state.trace.push(
    makeTraceEvent({
      layer: "preparatory",
      action: "problem_modeled",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `goal=${sanitizePreparatoryText(problem.goal)}; ` +
        `salience=${sanitizedSalientTerms.slice(0, 3).join(",")}; ` +
        `ambiguity=${ambiguity.ambiguityScore.toFixed(2)}`,
    }),
  );

  return handoffPreparatoryToReflective(state);
}