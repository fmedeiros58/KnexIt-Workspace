import { buildResponseLayoutPlan } from "../../src/18-presentation-and-delivery-layer/textual-layout-engine/response-layout-policy";
import { tokenStreamManager } from "../../src/18-presentation-and-delivery-layer/streaming-controller/token-stream-manager";
import { sentenceBuffering } from "../../src/18-presentation-and-delivery-layer/streaming-controller/sentence-buffering";
import { paragraphFlushLogic } from "../../src/18-presentation-and-delivery-layer/streaming-controller/paragraph-flush-logic";
import { progressiveRevealManager } from "../../src/18-presentation-and-delivery-layer/streaming-controller/progressive-reveal-manager";

describe("streaming long-form pipeline", () => {
  test("keeps paragraph coherence and emits multiple chunks for deep text", () => {
    const text = [
      "Primeiro, definimos o criterio dominante para orientar a decisao sob restricoes reais.",
      "Em seguida, mapeamos os conflitos entre risco, beneficio e equidade para evitar simplificacoes.",
      "Depois, comparamos alternativas com custos logicos, morais e institucionais explicitados.",
      "Por fim, fazemos critica da propria recomendacao e reformulacao sob incerteza de medicao.",
      "A conclusao final mantem coerencia entre premissas, metodo e limite epistemico declarado.",
      "Esse encadeamento reduz resposta fragmentada e aumenta utilidade pratica da saida.",
    ].join(" ");

    const plan = buildResponseLayoutPlan({
      text,
      prompt: "analise deliberativa profunda com varios subitens obrigatorios",
      hasCodeBlocks: false,
      hasCitations: false,
      hasMedia: false,
      hasEnumerativeSignals: false,
      requestedList: false,
      requestedHeading: false,
      route: "inferential",
      deliberativeActive: true,
      requiresStructuredCoverage: true,
      obligationCount: 7,
      reasoningIntensity: 0.82,
      structuralComplexity: 0.8,
      usesWorkingMemory: true,
      pendingObligations: ["demonstrar", "comparar", "objetar", "concluir"],
    });

    const tokens = tokenStreamManager({ text });
    const sentences = sentenceBuffering({ tokens: tokens.tokens, layoutPlan: plan });
    const paragraphs = paragraphFlushLogic({ sentences: sentences.sentences, layoutPlan: plan });
    const reveal = progressiveRevealManager({ paragraphs: paragraphs.paragraphs, layoutPlan: plan });

    expect(sentences.sentences.length).toBeGreaterThanOrEqual(4);
    expect(paragraphs.paragraphs.length).toBeGreaterThanOrEqual(1);
    expect(reveal.chunks.length).toBeGreaterThanOrEqual(2);
    expect(reveal.chunks[reveal.chunks.length - 1].done).toBe(true);
  });
});

