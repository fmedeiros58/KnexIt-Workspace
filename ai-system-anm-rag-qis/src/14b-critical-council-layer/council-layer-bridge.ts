/**
 * Layer: 14b-critical-council-layer
 * Module: council-layer-bridge
 * Responsibility: Apply critical council assessment before structure layer.
 */

import type {
  CouncilAction,
  CouncilAssessment,
  CouncilInput,
} from "./council-types";
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { runCriticalCouncilOrchestrator } from "./council-orchestrator";
import {
  bumpCouncilRevisionAttempt,
  canApplyCouncilRevision,
  getCouncilLoopStatus,
  hasCouncilLoopExhausted,
} from "./guards/council-loop-guard";
import { runCouncilSecondPassCheck } from "./repair/council-second-pass-checker";

const COUNTERPOINT_PATTERNS = [
  /\bpor[eé]m\b/i,
  /\bmas\b/i,
  /\bno entanto\b/i,
  /\bcontudo\b/i,
  /\bpor outro lado\b/i,
  /\bcontraponto\b/i,
  /\bhip[oó]tese alternativa\b/i,
  /\bhowever\b/i,
  /\bbut\b/i,
  /\bon the other hand\b/i,
  /\bcounterpoint\b/i,
  /\balternative hypothesis\b/i,
];

const EVIDENCE_BOUNDARY_PATTERNS = [
  /\bevid[eê]ncia\b/i,
  /\bfonte\b/i,
  /\bdados\b/i,
  /\binfer[eê]ncia\b/i,
  /\bhip[oó]tese\b/i,
  /\bincerteza\b/i,
  /\blimite\b/i,
  /\bressalva\b/i,
  /\bevidence\b/i,
  /\bsource\b/i,
  /\binference\b/i,
  /\bhypothesis\b/i,
  /\buncertainty\b/i,
  /\blimitation\b/i,
  /\bcaveat\b/i,
];

const PREMISE_TEST_PATTERNS = [
  /\bpremissa\b/i,
  /\bvalidar\b/i,
  /\bverificar\b/i,
  /\btestar\b/i,
  /\bn[aã]o necessariamente\b/i,
  /\bdepends\b/i,
  /\bpremise\b/i,
  /\bvalidate\b/i,
  /\bverify\b/i,
  /\btest\b/i,
  /\bnot necessarily\b/i,
];

const CONCLUSION_PATTERNS = [
  /\bconclus[aã]o\b/i,
  /\bconcluindo\b/i,
  /\bportanto\b/i,
  /\blogo\b/i,
  /\bem resumo\b/i,
  /\bresultado final\b/i,
  /\btherefore\b/i,
  /\bthus\b/i,
  /\bin conclusion\b/i,
  /\bin summary\b/i,
  /\bfinal answer\b/i,
];

function normalizeInline(text: string): string {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

function normalizeDraftText(text: string): string {
  const raw = String(text ?? "").trim();

  if (!raw) {
    return "";
  }

  const codeFenceRegex = /```[\s\S]*?```/g;
  const parts: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeFenceRegex.exec(raw)) !== null) {
    const prose = raw.slice(lastIndex, match.index);
    const normalizedProse = normalizeProseSegment(prose);

    if (normalizedProse) {
      parts.push(normalizedProse);
    }

    parts.push(match[0].trim());
    lastIndex = match.index + match[0].length;
  }

  const tail = normalizeProseSegment(raw.slice(lastIndex));

  if (tail) {
    parts.push(tail);
  }

  return dedupeParagraphs(parts.join("\n\n"));
}

function normalizeProseSegment(text: string): string {
  return String(text ?? "")
    .split(/\n{2,}/g)
    .map((paragraph) =>
      paragraph
        .split(/\n/g)
        .map((line) => normalizeInline(line))
        .filter(Boolean)
        .join(" "),
    )
    .map((paragraph) => normalizeInline(paragraph))
    .filter(Boolean)
    .join("\n\n");
}

function normalizeForMatch(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupe(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const cleaned = normalizeInline(value);
    const key = normalizeForMatch(cleaned);

    if (!cleaned || !key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

function dedupeParagraphs(text: string): string {
  const paragraphs = String(text ?? "")
    .split(/\n{2,}/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const result: string[] = [];

  for (const paragraph of paragraphs) {
    const key = normalizeForMatch(paragraph);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(paragraph);
  }

  return result.join("\n\n").trim();
}

function hasAnyPattern(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return dedupe(
    value
      .map((entry) => String(entry ?? "").trim())
      .filter(Boolean),
  );
}

function isDeliverableAction(action: CouncilAction): boolean {
  return action === "approve" || action === "send_with_caveat";
}

function inferLanguage(text: string): "pt" | "en" {
  const normalized = normalizeForMatch(text);

  const ptMarkers = [
    "voce",
    "você",
    "nao",
    "não",
    "preciso",
    "resposta",
    "conclusao",
    "conclusão",
    "porem",
    "porém",
    "mas",
    "evidencia",
    "evidência",
  ];

  const enMarkers = [
    "you",
    "your",
    "answer",
    "therefore",
    "however",
    "evidence",
    "conclusion",
    "must",
    "should",
  ];

  const ptScore = ptMarkers.filter((marker) =>
    normalized.includes(normalizeForMatch(marker)),
  ).length;

  const enScore = enMarkers.filter((marker) =>
    normalized.includes(normalizeForMatch(marker)),
  ).length;

  return enScore > ptScore ? "en" : "pt";
}

function removeSycophancyPatterns(text: string): string {
  return String(text ?? "")
    .replace(
      /\b(voc[eê] est[aá] absolutamente certo|concordo totalmente sem ressalvas|concordo plenamente sem ressalvas)\b/gi,
      "A premissa tem pontos válidos, mas precisa de verificação crítica",
    )
    .replace(
      /\b(you are absolutely right|i completely agree without caveats)\b/gi,
      "The premise has valid points, but it still needs critical verification",
    )
    .replace(
      /\b(est[aá] excelente sem ajustes|ficou perfeito sem ajustes|n[aã]o precisa mudar nada)\b/gi,
      "O material tem pontos fortes, mas exige ajustes objetivos",
    )
    .replace(
      /\b(perfect without changes|no changes needed|excellent without adjustments)\b/gi,
      "The material has strengths, but it requires objective adjustments",
    )
    .trim();
}

function buildCouncilInput(
  state: ProcessingState,
  draftAnswer: string,
): CouncilInput {
  return {
    userInput: state.normalizedMessage || state.rawMessage || "",
    draftAnswer,
    reasoningState: state.problemResolutionState || null,
    problemResolutionState: state.problemResolutionState || null,
    problemResolutionArtifact: state.executionArtifacts.problemResolution || null,
    retrievedEvidence: state.retrievedEvidence,
    retrievedSources: state.retrievedSources,
    taskContract: state.taskContract,
    languageHint: state.language,
    userLanguage: state.language,
    taskType: state.taskNatureState?.selectedTaskType,
    reflectiveState: state.reflectiveNotes,
    inferentialState: state.inferentialMap,
    epistemicState: state.epistemicIntegrationState,
    metacognitiveState: state.metacognitiveState,
    context: {
      activeConstraints: state.activeConstraints,
      responsePlan: state.responsePlanState,
    },
  };
}

function collectAssessmentRepairSignals(assessment: CouncilAssessment): string {
  const revisionPlan = assessment.revisionPlan;

  return normalizeForMatch(
    [
      ...(assessment.mainConcerns ?? []),
      ...(assessment.requiredRevisions ?? []),
      ...(assessment.optionalRevisions ?? []),
      ...(assessment.unsupportedClaims ?? []),
      ...(assessment.missingCounterpoints ?? []),
      ...(assessment.contradictions ?? []),
      ...(assessment.overAgreementSignals ?? []),
      revisionPlan?.revisionGoals ?? [],
      revisionPlan?.rewriteInstructions ?? [],
      revisionPlan?.logicInstructions ?? [],
      revisionPlan?.evidenceInstructions ?? [],
      revisionPlan?.antiSycophancyInstructions ?? [],
      revisionPlan?.toneInstructions ?? [],
      assessment.rewriteInstruction ?? "",
    ]
      .flat()
      .join(" "),
  );
}

function needsCounterpoint(assessment: CouncilAssessment): boolean {
  const signals = collectAssessmentRepairSignals(assessment);

  return /counterargument|counterpoint|objection|contraargumento|contraponto|contraexemplo|hipotese alternativa|hipótese alternativa|premise|premissa|skeptical/i.test(
    signals,
  );
}

function needsEvidenceBoundary(assessment: CouncilAssessment): boolean {
  const signals = collectAssessmentRepairSignals(assessment);

  return (
    (assessment.unsupportedClaims ?? []).length > 0 ||
    /evidence|evidencia|evidência|support|suporte|certeza|certainty|unsupported|sem suporte|fonte|source|confidence|confianca|confiança/i.test(
      signals,
    )
  );
}

function needsLogicalClosure(assessment: CouncilAssessment): boolean {
  const signals = collectAssessmentRepairSignals(assessment);

  return (
    (assessment.contradictions ?? []).length > 0 ||
    /logic|logica|lógica|conclusion|conclusao|conclusão|closure|fechamento|constraint|restricao|restrição|scenario|cenario|cenário|unresolved|nao resolvido|não resolvido/i.test(
      signals,
    )
  );
}

function needsPremiseChallenge(assessment: CouncilAssessment): boolean {
  const signals = collectAssessmentRepairSignals(assessment);

  return (
    (assessment.overAgreementSignals ?? []).length > 0 ||
    /sycophancy|bajula|agreement|over.?agreement|concordancia|concordância|premise_not_tested|premissa|premise/i.test(
      signals,
    )
  );
}

function buildCounterpointParagraph(language: "pt" | "en"): string {
  if (language === "en") {
    return "Counterpoint: before closing the answer, consider at least one plausible alternative interpretation and explain why it is weaker, stronger, or only partially applicable.";
  }

  return "Contraponto: antes de fechar a resposta, considere ao menos uma interpretação alternativa plausível e explique por que ela é mais fraca, mais forte ou apenas parcialmente aplicável.";
}

function buildEvidenceBoundaryParagraph(language: "pt" | "en"): string {
  if (language === "en") {
    return "Evidence boundary: where direct support is missing, present the claim as an inference or hypothesis, not as settled certainty.";
  }

  return "Limite de evidência: quando faltar suporte direto, apresente a afirmação como inferência ou hipótese, não como certeza estabelecida.";
}

function buildLogicalClosureParagraph(language: "pt" | "en"): string {
  if (language === "en") {
    return "Conclusion: the answer must preserve the user's constraints, close the reasoning chain, and make clear which conclusion follows from the premises.";
  }

  return "Conclusão: a resposta deve preservar as restrições do usuário, fechar a cadeia de raciocínio e deixar claro qual conclusão decorre das premissas.";
}

function buildPremiseChallengeParagraph(language: "pt" | "en"): string {
  if (language === "en") {
    return "Premise check: do not treat the user's framing as automatically true. State what is valid, what is fragile, and what still needs verification.";
  }

  return "Verificação da premissa: não trate o enquadramento do usuário como automaticamente verdadeiro. Indique o que é válido, o que é frágil e o que ainda precisa de verificação.";
}

function appendParagraphIfMissing(
  draft: string,
  paragraph: string,
  existingPatterns: readonly RegExp[],
): string {
  if (!paragraph.trim() || hasAnyPattern(draft, existingPatterns)) {
    return draft;
  }

  return `${draft.trim()}\n\n${paragraph.trim()}`;
}

function applyRevisionByPlan(
  base: string,
  assessment: CouncilAssessment,
  councilInput: CouncilInput,
): string {
  const language = inferLanguage(councilInput.userInput || base);
  let revised = removeSycophancyPatterns(base);

  if (needsPremiseChallenge(assessment)) {
    revised = appendParagraphIfMissing(
      revised,
      buildPremiseChallengeParagraph(language),
      PREMISE_TEST_PATTERNS,
    );
  }

  if (needsCounterpoint(assessment)) {
    revised = appendParagraphIfMissing(
      revised,
      buildCounterpointParagraph(language),
      COUNTERPOINT_PATTERNS,
    );
  }

  if (needsEvidenceBoundary(assessment)) {
    revised = appendParagraphIfMissing(
      revised,
      buildEvidenceBoundaryParagraph(language),
      EVIDENCE_BOUNDARY_PATTERNS,
    );
  }

  if (needsLogicalClosure(assessment)) {
    revised = appendParagraphIfMissing(
      revised,
      buildLogicalClosureParagraph(language),
      CONCLUSION_PATTERNS,
    );
  }

  return normalizeDraftText(revised);
}

function shouldAttemptCouncilRevision(
  state: ProcessingState,
  assessment: CouncilAssessment,
): boolean {
  const actionAllowsRepair =
    assessment.action === "revise" ||
    assessment.action === "regenerate" ||
    assessment.action === "send_with_caveat";

  const planRequiresRepair =
    Boolean(assessment.revisionPlan?.revisionRequired) ||
    Boolean(assessment.revisionPlan?.regenerationRequired) ||
    (assessment.requiredRevisions ?? []).length > 0 ||
    Boolean(assessment.rewriteInstruction);

  return (
    actionAllowsRepair &&
    planRequiresRepair &&
    canApplyCouncilRevision(state) &&
    !hasCouncilLoopExhausted(state)
  );
}

function commitDraft(state: ProcessingState, text: string): void {
  const normalized = normalizeDraftText(text);

  state.reasonedDraft = normalized;
  state.draftResponse = {
    text: normalized,
    sections: [{ title: "Resposta", content: normalized }],
  };
}

function mergeSecondPassAssessment(input: {
  readonly secondAssessment: CouncilAssessment;
  readonly finalAction: CouncilAction;
  readonly canDeliver: boolean;
  readonly secondPass: CouncilAssessment["secondPass"];
}): CouncilAssessment {
  const { secondAssessment, finalAction, canDeliver, secondPass } = input;

  return {
    ...secondAssessment,
    secondPass,
    action: finalAction,
    approved: isDeliverableAction(finalAction),
    deliveryDecision: {
      ...secondAssessment.deliveryDecision,
      canDeliver,
      requiredAction: finalAction,
      reasons: dedupe([
        ...(secondAssessment.deliveryDecision?.reasons ?? []),
        ...(canDeliver ? [] : ["second_pass_requires_non_delivery_action"]),
      ]),
    },
  };
}

function finalizeAssessment(
  state: ProcessingState,
  assessment: CouncilAssessment,
): void {
  const previousCriticalCouncil = state.executionArtifacts.criticalCouncil || {};
  const revisionAttempts =
    state.executionArtifacts.criticalCouncil?.revisionAttempts || 0;

  state.councilAssessment = assessment;
  state.executionArtifacts.criticalCouncil = {
    ...previousCriticalCouncil,
    approved: assessment.approved,
    action: assessment.action,
    sycophancyRisk: assessment.sycophancyRisk,
    logicRisk: assessment.logicRisk,
    evidenceRisk: assessment.evidenceRisk,
    completenessRisk: assessment.completenessRisk,
    communicationRisk: assessment.communicationRisk,
    concerns: assessment.mainConcerns,
    requiredRevisions: assessment.requiredRevisions,
    optionalRevisions: assessment.optionalRevisions,
    deliveryBlocked: !assessment.deliveryDecision.canDeliver,
    finalAction: assessment.deliveryDecision.requiredAction,
    rewriteInstruction: assessment.rewriteInstruction,
    revisionAttempts,
  };
}

function pushCouncilTrace(input: {
  readonly state: ProcessingState;
  readonly action: string;
  readonly startedAt: number;
  readonly detail?: string;
}): void {
  input.state.trace.push(
    makeTraceEvent({
      layer: "critical-council",
      action: input.action,
      route: input.state.executionPlan.selectedRoute,
      latencyMs: Date.now() - input.startedAt,
      detail: input.detail,
    }),
  );
}

function buildAssessmentTraceDetail(
  assessment: CouncilAssessment,
  state: ProcessingState,
): string {
  const loopStatus = getCouncilLoopStatus(state);

  return (
    `action=${assessment.action}; approved=${assessment.approved}; ` +
    `sycophancy=${assessment.sycophancyRisk}; logic=${assessment.logicRisk}; ` +
    `evidence=${assessment.evidenceRisk}; completeness=${assessment.completenessRisk}; ` +
    `communication=${assessment.communicationRisk}; revisions=${assessment.requiredRevisions.length}; ` +
    `deliver=${assessment.deliveryDecision.canDeliver}; ` +
    `revisionAttempts=${loopStatus.attempts}/${loopStatus.maxRevisions}`
  );
}

export async function runCriticalCouncilLayer(
  state: ProcessingState,
): Promise<ProcessingState> {
  const startedAt = Date.now();
  const candidate = normalizeDraftText(
    state.reasonedDraft || state.draftResponse?.text || "",
  );

  if (!candidate) {
    pushCouncilTrace({
      state,
      action: "critical_council_skipped_empty_candidate",
      startedAt,
    });

    return state;
  }

  const firstInput = buildCouncilInput(state, candidate);
  const firstAssessment = runCriticalCouncilOrchestrator(firstInput);
  let finalAssessment = firstAssessment;

  if (shouldAttemptCouncilRevision(state, firstAssessment)) {
    bumpCouncilRevisionAttempt(state);

    const revisedDraft = applyRevisionByPlan(
      candidate,
      firstAssessment,
      firstInput,
    );

    if (revisedDraft && normalizeForMatch(revisedDraft) !== normalizeForMatch(candidate)) {
      commitDraft(state, revisedDraft);

      const secondInput = buildCouncilInput(state, revisedDraft);
      const secondAssessment = runCriticalCouncilOrchestrator(secondInput);
      const secondPass = runCouncilSecondPassCheck({
        originalAssessment: firstAssessment,
        revisedAssessment: secondAssessment,
        revisedDraft,
        councilInput: secondInput,
      });

      finalAssessment = mergeSecondPassAssessment({
        secondAssessment,
        secondPass,
        finalAction: secondPass.finalAction,
        canDeliver: isDeliverableAction(secondPass.finalAction),
      });
    }
  }

  finalizeAssessment(state, finalAssessment);

  pushCouncilTrace({
    state,
    action: "critical_council_assessed",
    startedAt,
    detail: buildAssessmentTraceDetail(finalAssessment, state),
  });

  return state;
}
