import { routeComplexity } from "@/core/rag/complexity-router";

describe("routeComplexity", () => {
  it("forca LITE para saudacao curta", () => {
    const decision = routeComplexity({
      text: "oi",
      hasAttachments: false,
      hasDocumentScope: false,
      hasConversationContext: false,
    });
    expect(decision.mode).toBe("lite");
    expect(decision.hardRule).toBe("FORCE_LITE");
  });

  it("forca FULL quando ha escopo documental", () => {
    const decision = routeComplexity({
      text: "faça um resumo",
      hasAttachments: false,
      hasDocumentScope: true,
      hasConversationContext: false,
    });
    expect(decision.mode).toBe("full");
    expect(decision.hardRule).toBe("FORCE_FULL");
  });

  it("forca FULL para pedido de patch/codigo", () => {
    const decision = routeComplexity({
      text: "implemente um patch para esse endpoint",
      hasAttachments: false,
      hasDocumentScope: false,
      hasConversationContext: false,
    });
    expect(decision.mode).toBe("full");
    expect(decision.reasons.some((reason) => reason.includes("HARD_FULL_CODE_OR_ARCH"))).toBe(true);
  });

  it("classifica pergunta multi-etapas como FULL", () => {
    const decision = routeComplexity({
      text: "analise esse fluxo e faça um passo a passo com checklist e roadmap?",
      hasAttachments: false,
      hasDocumentScope: false,
      hasConversationContext: true,
    });
    expect(decision.mode).toBe("full");
    expect(decision.score).toBeGreaterThan(0);
  });

  it("mantem micro-resposta como LITE", () => {
    const decision = routeComplexity({
      text: "blz",
      hasAttachments: false,
      hasDocumentScope: false,
      hasConversationContext: true,
    });
    expect(decision.mode).toBe("lite");
    expect(decision.score).toBeLessThanOrEqual(0);
  });

  it("trata pergunta factual curta com grounding como FULL", () => {
    const decision = routeComplexity({
      text: "qual a capital do brasil?",
      hasAttachments: false,
      hasDocumentScope: false,
      hasConversationContext: false,
    });
    expect(decision.mode).toBe("full");
    expect(decision.reasons.some((reason) => reason.includes("SHORT_FACTUAL_QUESTION"))).toBe(true);
    expect(decision.reasons.some((reason) => reason.includes("FACTUAL_GROUNDING"))).toBe(true);
  });
});
