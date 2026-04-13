import { buildResponseLayoutPlan } from "../../src/18-presentation-and-delivery-layer/textual-layout-engine/response-layout-policy";
import { textualOutputAuditor } from "../../src/18-presentation-and-delivery-layer/textual-layout-engine/textual-output-auditor";
import { validateLongFormMemoryConsumption } from "../../src/18-presentation-and-delivery-layer/textual-layout-engine/long-form-memory-consumption-validator";
import { validateMultiCallContinuity } from "../../src/18-presentation-and-delivery-layer/textual-layout-engine/multi-call-continuity-validator";
import { validateDiscourseCohesion } from "../../src/18-presentation-and-delivery-layer/textual-layout-engine/discourse-cohesion-validator";

describe("textual long-form auditor", () => {
  test("merges excessive fragmented paragraphs", () => {
    const fragmented = [
      "O problema envolve criterios concorrentes.",
      "Por isso a resposta precisa ser estruturada.",
      "Nesse sentido cada criterio deve ter peso explicito.",
      "Assim evitamos arbitrariedade na decisao.",
      "Alem disso os custos precisam ser comparados.",
      "Por fim a recomendacao precisa ser auditavel.",
    ].join("\n\n");

    const plan = buildResponseLayoutPlan({
      text: fragmented,
      prompt: "analise profunda com varios criterios e justificativa completa",
      hasCodeBlocks: false,
      hasCitations: false,
      hasMedia: false,
      hasEnumerativeSignals: false,
      requestedList: false,
      requestedHeading: false,
      route: "inferential",
      deliberativeActive: true,
      requiresStructuredCoverage: true,
      obligationCount: 6,
      reasoningIntensity: 0.8,
      structuralComplexity: 0.75,
      usesWorkingMemory: true,
      pendingObligations: ["demonstrar", "comparar modelos"],
    });

    const audited = textualOutputAuditor(fragmented, plan, {
      prompt: "analise profunda",
      longFormDiscourse: {
        isActive: true,
        pendingObligations: ["demonstrar", "comparar modelos"],
        completedObligations: [],
        paragraphHistory: [],
        transitionPlan: ["demonstrar -> comparar modelos"],
        antiRepetitionLedger: [],
        usesWorkingMemory: true,
        memoryAnchors: ["criterios concorrentes", "peso explicito"],
      },
    });

    const repaired = `${audited.repairedText || fragmented}`.trim();
    const repairedParagraphs = repaired.split(/\n{2,}/g).filter(Boolean);
    expect(repairedParagraphs.length).toBeLessThanOrEqual(4);
  });

  test("splits huge monoblock in deep mode", () => {
    const monoblock = Array.from({ length: 14 })
      .map(
        () =>
          "A resposta deve manter continuidade argumentativa, preservar premissas, explicitar transicoes e evitar repeticao sem perder densidade analitica.",
      )
      .join(" ");

    const plan = buildResponseLayoutPlan({
      text: monoblock,
      prompt: "resposta analitica profunda e longa",
      hasCodeBlocks: false,
      hasCitations: false,
      hasMedia: false,
      hasEnumerativeSignals: false,
      requestedList: false,
      requestedHeading: true,
      route: "inferential",
      deliberativeActive: true,
      requiresStructuredCoverage: true,
      obligationCount: 5,
      reasoningIntensity: 0.78,
      structuralComplexity: 0.72,
      usesWorkingMemory: true,
      pendingObligations: ["provar", "concluir"],
    });

    const audited = textualOutputAuditor(monoblock, plan);
    const repaired = `${audited.repairedText || monoblock}`.trim();
    expect(/\n{2,}/.test(repaired)).toBe(true);
  });

  test("validates memory anchors consumption", () => {
    const memoryValidation = validateLongFormMemoryConsumption("A decisao segue criterio de equidade e custo marginal.", {
      longFormDiscourse: {
        isActive: true,
        pendingObligations: ["avaliar trade-off"],
        completedObligations: [],
        paragraphHistory: [],
        transitionPlan: [],
        antiRepetitionLedger: [],
        usesWorkingMemory: true,
        memoryAnchors: ["equidade", "custo marginal"],
      },
    });
    expect(memoryValidation.passed).toBe(true);
  });

  test("flags repeated multi-call lead", () => {
    const continuity = validateMultiCallContinuity("A decisao exige equilibrio entre risco e beneficio.", {
      longFormDiscourse: {
        isActive: true,
        pendingObligations: ["comparar modelos"],
        completedObligations: [],
        paragraphHistory: ["A decisao exige equilibrio entre risco e beneficio."],
        transitionPlan: ["comparar modelos -> justificar escolha"],
        antiRepetitionLedger: [],
        usesWorkingMemory: true,
        memoryAnchors: [],
      },
    });
    expect(continuity.passed).toBe(false);
  });

  test("keeps cohesion score above floor for coherent text", () => {
    const cohesion = validateDiscourseCohesion(
      [
        "A primeira parte define o problema de decisao sob restricoes.",
        "A segunda parte compara alternativas com base em criterios explicitos.",
        "A terceira parte fecha com recomendacao e condicoes de revisao.",
      ].join("\n\n"),
      buildResponseLayoutPlan({
        text: "texto de analise coesa em varios paragrafos",
        prompt: "analise comparativa",
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
        reasoningIntensity: 0.65,
        structuralComplexity: 0.6,
        usesWorkingMemory: true,
        pendingObligations: ["comparar", "concluir"],
      }),
    );
    expect(cohesion.score).toBeGreaterThan(0.4);
  });
});

