import { buildResponseLayoutPlan } from "../../src/18-presentation-and-delivery-layer/textual-layout-engine/response-layout-policy";
import { runResponseCompletionOrchestrator } from "../../src/18-presentation-and-delivery-layer/textual-layout-engine/response-completion-orchestrator";

describe("response completion orchestrator", () => {
  test("signals pending emission without fabricating semantic filler", () => {
    const partial = [
      "A analise ja definiu os criterios de decisao e o primeiro modelo.",
      "No entanto, o custo institucional ainda esta em aberto e a",
    ].join(" ");

    const plan = buildResponseLayoutPlan({
      text: partial,
      prompt: "analise profunda com demonstracao, modelos, objecao e conclusao",
      hasCodeBlocks: false,
      hasCitations: false,
      hasMedia: false,
      hasEnumerativeSignals: true,
      requestedList: false,
      requestedHeading: false,
      route: "inferential",
      deliberativeActive: true,
      requiresStructuredCoverage: true,
      obligationCount: 6,
      reasoningIntensity: 0.82,
      structuralComplexity: 0.78,
      usesWorkingMemory: true,
      pendingObligations: ["demonstrar", "comparar modelos", "objecao", "concluir"],
    });

    const result = runResponseCompletionOrchestrator(partial, {
      prompt: "analise profunda",
      plan,
      longFormDiscourse: {
        isActive: true,
        pendingObligations: ["demonstrar", "comparar modelos", "objecao", "concluir"],
        completedObligations: ["definir termos"],
        paragraphHistory: ["A analise ja definiu os criterios de decisao."],
        transitionPlan: ["demonstrar -> comparar modelos", "comparar modelos -> objecao"],
        antiRepetitionLedger: [],
        usesWorkingMemory: true,
        memoryAnchors: ["criterios de decisao", "custo institucional"],
      },
      taskExecutionState: {
        detectedObligations: ["demonstrar", "comparar modelos", "objecao", "concluir"],
        obligationSatisfactionScores: [
          {
            obligationId: "obl_1",
            label: "demonstrar",
            type: "demonstration",
            score: 0.42,
            passed: false,
            issues: ["assertion_without_derivation"],
          },
          {
            obligationId: "obl_2",
            label: "comparar modelos",
            type: "comparison",
            score: 0.48,
            passed: false,
            issues: ["missing_tradeoffs"],
          },
        ],
        integrityChecks: {
          isTruncated: true,
          hasAbruptEnding: true,
          missingSections: ["conclusion"],
          issues: ["cut_word_ending"],
        },
        finalExecutionGate: {
          shouldBlock: true,
          blockReasons: ["coverage_below_threshold"],
        },
      },
    });

    expect(result.state.shouldContinue).toBe(true);
    expect(result.state.canSafelyTerminate).toBe(false);
    expect(result.state.pendingCriticalObligations.length).toBeGreaterThan(0);
    expect(result.state.completionScore).toBeGreaterThan(0.2);
    expect(result.text).not.toContain("Completo o proximo ponto pendente");
    expect(result.text).not.toContain("Conclusao final: a resposta so se encerra");
  });

  test("allows safe termination for complete deep response", () => {
    const complete = [
      "Primeiro eu defino os termos, explicito as premissas e delimito o dominio do problema.",
      "Em seguida eu demonstro a tensao entre criterios concorrentes com encadeamento inferencial e comparacao entre modelos.",
      "Depois eu apresento a objecao mais forte contra a propria recomendacao e reviso a conclusao sob incerteza.",
      "Conclusao final: a escolha robusta depende de preservar integridade metodologica, explicitar trade-offs e declarar pressupostos nao provados.",
    ].join("\n\n");

    const plan = buildResponseLayoutPlan({
      text: complete,
      prompt: "resposta profunda com cobertura integral",
      hasCodeBlocks: false,
      hasCitations: false,
      hasMedia: false,
      hasEnumerativeSignals: false,
      requestedList: false,
      requestedHeading: false,
      route: "inferential",
      deliberativeActive: true,
      requiresStructuredCoverage: true,
      obligationCount: 4,
      reasoningIntensity: 0.75,
      structuralComplexity: 0.7,
      usesWorkingMemory: true,
      pendingObligations: [],
    });

    const result = runResponseCompletionOrchestrator(complete, {
      prompt: "resposta profunda",
      plan,
      longFormDiscourse: {
        isActive: true,
        pendingObligations: [],
        completedObligations: ["definir", "demonstrar", "objetar", "concluir"],
        paragraphHistory: [],
        transitionPlan: [],
        antiRepetitionLedger: [],
        usesWorkingMemory: true,
        memoryAnchors: ["premissas", "trade-offs", "conclusao"],
      },
      taskExecutionState: {
        detectedObligations: [],
        obligationSatisfactionScores: [],
        integrityChecks: {
          isTruncated: false,
          hasAbruptEnding: false,
          missingSections: [],
          issues: [],
        },
        finalExecutionGate: {
          shouldBlock: false,
          blockReasons: [],
        },
      },
    });

    expect(result.state.shouldContinue).toBe(false);
    expect(result.state.canSafelyTerminate).toBe(true);
    expect(result.state.pendingCriticalObligations.length).toBe(0);
    expect(result.state.hasOpenSection).toBe(false);
  });
});
