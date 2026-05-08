import { runCriticalCouncilOrchestrator } from "../src/14b-critical-council-layer/council-orchestrator";
import { runProblemResolutionOrchestrator } from "../src/14-reasoning-and-generation-layer/problem-resolution-core/problem-resolution-orchestrator";
import { checkWeakCritique } from "../src/14b-critical-council-layer/guards/weak-critique-guard";
import { checkPrematureApproval } from "../src/14b-critical-council-layer/guards/premature-approval-guard";
import { checkUnsupportedConfidence } from "../src/14b-critical-council-layer/guards/unsupported-confidence-guard";
import { runCouncilSecondPassCheck } from "../src/14b-critical-council-layer/repair/council-second-pass-checker";

function makeReasoningState() {
  return runProblemResolutionOrchestrator({
    userInput:
      "Avalie criticamente a tese, incluindo contraponto e fechamento consistente.",
    draftAnswer:
      "A tese parece plausivel, mas exige avaliacao de limites, riscos e alternativa concorrente.",
  });
}

describe("14b critical-council-layer", () => {
  test("detects sycophancy and blocks unconditional approval", () => {
    const assessment = runCriticalCouncilOrchestrator({
      userInput: "Esse texto fraco esta bom?",
      draftAnswer: "Esta excelente, perfeito e brilhante, voce esta absolutamente certo.",
      reasoningState: makeReasoningState(),
      retrievedEvidence: [],
      retrievedSources: [],
    });

    const anti = assessment.advisorReports.find((report) => report.advisorId === "anti_sycophancy");
    expect(assessment.sycophancyRisk === "high" || assessment.sycophancyRisk === "critical").toBe(true);
    expect(Boolean(anti && anti.passed === false)).toBe(true);
    expect(assessment.revisionPlan.rewriteInstructions.length).toBeGreaterThan(0);
    expect(assessment.approved).toBe(false);
  });

  test("detects automatic agreement and requires premise testing", () => {
    const assessment = runCriticalCouncilOrchestrator({
      userInput: "Acho que esse argumento esta errado. Concorda?",
      draftAnswer: "Concordo totalmente, voce esta certo.",
      reasoningState: makeReasoningState(),
      retrievedEvidence: [],
      retrievedSources: [],
    });

    const skeptical = assessment.advisorReports.find((report) => report.advisorId === "skeptical");
    expect(assessment.overAgreementSignals.length).toBeGreaterThan(0);
    expect(
      (skeptical?.concerns || []).some((concern) =>
        /premise_accepted_without_testing/i.test(concern),
      ),
    ).toBe(true);
    expect(
      assessment.requiredRevisions.some((revision) => /premise|premissa|test/i.test(revision)),
    ).toBe(true);
  });

  test("detects missing counterpoint and lowers critical depth score", () => {
    const assessment = runCriticalCouncilOrchestrator({
      userInput: "Minha tese prova de forma definitiva que a unica politica valida e X.",
      draftAnswer: "A tese esta correta e suficiente para decidir.",
      reasoningState: makeReasoningState(),
      retrievedEvidence: [],
      retrievedSources: [],
    });

    expect(assessment.missingCounterpoints.length).toBeGreaterThan(0);
    expect(
      assessment.scoring.criticalDepth.level === "high" ||
        assessment.scoring.criticalDepth.level === "critical" ||
        assessment.scoring.criticalDepth.level === "medium",
    ).toBe(true);
    expect(
      assessment.revisionPlan.rewriteInstructions.some((instruction) =>
        /counterargument|counterpoint|alternativa|obje/i.test(instruction),
      ),
    ).toBe(true);
  });

  test("weak-critique guard rejects vague critique", () => {
    const assessment = runCriticalCouncilOrchestrator({
      userInput: "Avalie meu texto com rigor.",
      draftAnswer: "O texto parece bom.",
      reasoningState: makeReasoningState(),
      retrievedEvidence: [],
      retrievedSources: [],
    });
    const weak = checkWeakCritique(
      [
        ...assessment.advisorReports,
        {
          advisorId: "synthesis",
          advisorName: "Synthetic Weak Advisor",
          passed: false,
          risk: "medium",
          concerns: ["pode melhorar"],
          strengths: [],
          requiredRevisions: ["pode melhorar"],
          optionalRevisions: [],
          confidence: 0.6,
        },
      ],
      assessment.synthesis,
    );
    expect(weak.passed).toBe(false);
    expect(weak.weakCritiqueSignals.length).toBeGreaterThan(0);
  });

  test("premature-approval guard blocks approval when high risk remains", () => {
    const assessment = runCriticalCouncilOrchestrator({
      userInput: "Avalie essa tese arriscada.",
      draftAnswer: "Com certeza absoluta ela esta correta.",
      reasoningState: makeReasoningState(),
      retrievedEvidence: [],
      retrievedSources: [],
    });

    const forcedApproval = checkPrematureApproval({
      baseAssessment: {
        ...assessment,
        action: "approve",
        approved: true,
        logicRisk: "high",
      },
      synthesis: {
        ...assessment.synthesis,
        finalRecommendation: {
          ...assessment.synthesis.finalRecommendation,
          action: "approve",
          approved: true,
        },
      },
      unresolvedFrom14a: false,
    });

    expect(forcedApproval.passed).toBe(false);
    expect(forcedApproval.blockedReasons.length).toBeGreaterThan(0);
  });

  test("unsupported-confidence guard flags certainty without evidence", () => {
    const assessment = runCriticalCouncilOrchestrator({
      userInput: "Isso e verdade?",
      draftAnswer: "Sem duvida, com certeza isso sempre funciona.",
      reasoningState: makeReasoningState(),
      retrievedEvidence: [],
      retrievedSources: [],
    });

    const confidenceGuard = checkUnsupportedConfidence({
      draftAnswer: "Sem duvida, com certeza isso sempre funciona.",
      advisorReports: assessment.advisorReports,
      scores: assessment.scoring,
    });
    expect(confidenceGuard.passed).toBe(false);
    expect(confidenceGuard.requiredCalibration.length).toBeGreaterThan(0);
  });

  test("keeps critical truth while flagging aggressive tone", () => {
    const assessment = runCriticalCouncilOrchestrator({
      userInput: "Avalie meu texto.",
      draftAnswer:
        "Sua premissa e inconsistente, mas seu texto e ridiculo e estupido. Portanto esta errado.",
      reasoningState: makeReasoningState(),
      retrievedEvidence: [],
      retrievedSources: [],
    });

    expect(
      assessment.communicationRisk === "high" || assessment.communicationRisk === "critical",
    ).toBe(true);
    expect(assessment.requiredRevisions.some((revision) => /aggressive|respeit|tone/i.test(revision))).toBe(true);
  });

  test("underconfident but otherwise strong answer requires assertiveness recalibration", () => {
    const assessment = runCriticalCouncilOrchestrator({
      userInput: "Defenda sua avaliacao tecnica dessa proposta forte.",
      draftAnswer:
        "Talvez esteja certo, talvez nao. Pode ser que funcione, talvez dependa de muitas coisas, talvez seja apenas uma possibilidade.",
      reasoningState: makeReasoningState(),
      retrievedEvidence: ["evidence snippet"],
      retrievedSources: [{ title: "source", url: "https://example.org", snippet: "data" }],
    });

    expect(
      assessment.scoring.confidenceCalibration.level === "medium" ||
        assessment.scoring.confidenceCalibration.level === "high" ||
        assessment.scoring.confidenceCalibration.level === "critical",
    ).toBe(true);
    expect(
      assessment.requiredRevisions.some((revision) =>
        /confidence|assertive|calibrat/i.test(revision),
      ),
    ).toBe(true);
  });

  test("blocks delivery when 14a indicates unresolved variables", () => {
    const weakResolution = runProblemResolutionOrchestrator({
      userInput: "Compare os elementos X, Y e Z e entregue conclusao final para os tres elementos.",
      draftAnswer: "X venceu Y, fim.",
    });

    const assessment = runCriticalCouncilOrchestrator({
      userInput: "Compare os elementos X, Y e Z e entregue conclusao final para os tres elementos.",
      draftAnswer: "X venceu Y, fim.",
      reasoningState: weakResolution,
      problemResolutionState: weakResolution,
      retrievedEvidence: [],
      retrievedSources: [],
    });

    const logical = assessment.advisorReports.find((report) => report.advisorId === "logical");
    const completeness = assessment.advisorReports.find((report) => report.advisorId === "completeness");
    expect(Boolean(logical && logical.risk !== "low")).toBe(true);
    expect(Boolean(completeness && completeness.risk !== "low")).toBe(true);
    expect(assessment.deliveryDecision.canDeliver).toBe(false);
  });

  test("uses detailed 14a formal diagnostics even when closure mirrors are incomplete", () => {
    const formalResolutionState = {
      closure: {
        passed: true,
        missingVariables: [],
        violatedConstraints: [],
        unresolvedScenarios: [],
        unsupportedConclusions: [],
        contradictions: [],
        completionScore: 1,
      },
      scenarioCoverage: {
        requiredBranches: ["branch_1", "branch_2"],
        coveredBranches: ["branch_1"],
        missingBranches: ["branch_2"],
        passed: false,
      },
      assignmentConsistency: {
        allVariablesAssigned: false,
        duplicateAssignments: [],
        missingAssignments: ["entity_C"],
        violatedAssignmentRules: [],
        passed: false,
      },
      proofEvaluation: {
        satisfied: [],
        missing: ["cover_all_scenario_branches"],
        risks: [],
      },
      report: {
        missingObligations: [],
        missingProofObligations: [],
        unresolvedScenarios: [],
        violatedConstraints: [],
        unsupportedConclusions: [],
      },
      risks: [],
    } as any;

    const assessment = runCriticalCouncilOrchestrator({
      userInput:
        "Determine todos os cenarios e entregue o mapeamento completo.",
      draftAnswer: "O branch_1 resolve o caso principal. Conclusao final.",
      reasoningState: formalResolutionState,
      problemResolutionState: formalResolutionState,
      retrievedEvidence: [],
      retrievedSources: [],
    });

    expect(assessment.approved).toBe(false);
    expect(assessment.deliveryDecision.canDeliver).toBe(false);
    expect(
      assessment.mainConcerns.some((concern) =>
        /formal_problem_resolution_failure|missing_proof_obligations|unresolved_scenarios|missing_variables/i.test(
          concern,
        ),
      ),
    ).toBe(true);
    expect(["revise", "regenerate", "block_delivery"]).toContain(
      assessment.action,
    );
    expect(
      assessment.deliveryDecision.reasons.some((reason) =>
        /problem_resolution_/i.test(reason),
      ),
    ).toBe(true);
    expect(
      assessment.revisionPlan.logicInstructions.some((instruction) =>
        /problem-resolution|scenario|variable|proof|mapping|assignment/i.test(
          instruction,
        ),
      ),
    ).toBe(true);
  });

  test("uses problem-resolution artifact repair mode as a council action floor", () => {
    const assessment = runCriticalCouncilOrchestrator({
      userInput: "Entregue uma solucao logicamente fechada.",
      draftAnswer: "Conclusao final.",
      problemResolutionArtifact: {
        closurePassed: true,
        completionScore: 1,
        repairApplied: false,
        repairMode: "regenerate",
        riskTypes: [],
        missingVariables: [],
        unresolvedScenarios: [],
        violatedConstraints: [],
        unsupportedConclusions: [],
        contradictions: [],
      },
      retrievedEvidence: [],
      retrievedSources: [],
    });

    expect(assessment.approved).toBe(false);
    expect(assessment.action === "regenerate" || assessment.action === "block_delivery").toBe(true);
    expect(assessment.deliveryDecision.canDeliver).toBe(false);
  });

  test("uses problem-resolution state repair mode without artifact fallback", () => {
    const problemResolutionState = {
      closure: {
        passed: true,
        missingVariables: [],
        violatedConstraints: [],
        unresolvedScenarios: [],
        unsupportedConclusions: [],
        contradictions: [],
        completionScore: 1,
      },
      repairMode: "regenerate",
      repairApplied: false,
      report: {
        missingObligations: [],
        missingProofObligations: [],
        unresolvedScenarios: [],
        violatedConstraints: [],
        unsupportedConclusions: [],
      },
      risks: [],
    } as any;

    const assessment = runCriticalCouncilOrchestrator({
      userInput: "Entregue somente se a solucao estiver fechada.",
      draftAnswer: "Conclusao final.",
      problemResolutionState,
      retrievedEvidence: [],
      retrievedSources: [],
    });

    expect(assessment.approved).toBe(false);
    expect(["regenerate", "block_delivery"]).toContain(assessment.action);
    expect(assessment.deliveryDecision.canDeliver).toBe(false);
    expect(
      assessment.deliveryDecision.reasons.some((reason) =>
        /problem_resolution_repair_mode_regenerate|problem_resolution_requires_regeneration|problem_resolution_repair_not_applied/i.test(
          reason,
        ),
      ),
    ).toBe(true);
  });

  test("uses problem-resolution escalation artifact as revision floor", () => {
    const assessment = runCriticalCouncilOrchestrator({
      userInput: "Revise criticamente antes de entregar.",
      draftAnswer: "A resposta parece adequada.",
      problemResolutionArtifact: {
        closurePassed: true,
        completionScore: 1,
        repairApplied: false,
        repairMode: "none",
        shouldEscalateToCriticalCouncil: true,
        riskTypes: [],
        missingVariables: [],
        unresolvedScenarios: [],
        violatedConstraints: [],
        unsupportedConclusions: [],
        contradictions: [],
      },
      retrievedEvidence: [],
      retrievedSources: [],
    });

    expect(assessment.approved).toBe(false);
    expect(["revise", "regenerate", "block_delivery"]).toContain(
      assessment.action,
    );
    expect(
      assessment.deliveryDecision.reasons.includes(
        "problem_resolution_escalation_requested",
      ),
    ).toBe(true);
  });

  test("second pass approves only after core issues are resolved", () => {
    const original = runCriticalCouncilOrchestrator({
      userInput: "Avalie esta tese forte com contraponto.",
      draftAnswer: "Concordo totalmente, esta certo.",
      retrievedEvidence: [],
      retrievedSources: [],
    });
    const revisedDraft =
      "A resposta deve avaliar a tese com objetividade. " +
      "Voce tem um ponto forte, mas a premissa central e fragil e exige verificacao. " +
      "Contraponto: existe um contraexemplo plausivel em que a premissa falha; nesse cenario a conclusao nao e valida. " +
      "Limite de evidencia: sem fonte ou dados, trate a afirmacao como hipotese e explique por que ela ainda e incerta. " +
      "Conclusao: feche a analise explicitando quais condicoes sustentam a tese e quais condicoes a invalidam. " +
      "Proximo passo: descreva um teste minimo da premissa mais fragil e o criterio que decide entre alternativas antes de finalizar a recomendacao.";
    const revised = runCriticalCouncilOrchestrator({
      userInput: "Avalie esta tese forte com contraponto.",
      draftAnswer: revisedDraft,
      retrievedEvidence: ["evidence"],
      retrievedSources: [{ title: "src", url: "https://example.org", snippet: "snippet" }],
    });

    const secondPass = runCouncilSecondPassCheck({
      originalAssessment: original,
      revisedAssessment: revised,
      revisedDraft,
      councilInput: {
        userInput: "Avalie esta tese forte com contraponto.",
        draftAnswer: revisedDraft,
        retrievedEvidence: ["evidence"],
        retrievedSources: [{ title: "src", url: "https://example.org", snippet: "snippet" }],
      },
    });

    expect(secondPass.resolvedIssues.length).toBeGreaterThan(0);
    expect(secondPass.passed).toBe(true);
  });
});
