import { createDefaultProgressSignals } from "@/core/assistant/progress/progress-signals";
import type { PipelineContext } from "@/core/assistant/pipeline/pipeline-context";
import { LanguageStage } from "@/core/assistant/pipeline/stages/language.stage";

function makeContext(message: string): PipelineContext {
  return {
    requestId: "test-req",
    conversationKey: "test-language",
    mode: "chat",
    stream: false,
    userMessage: message,
    conversation: [],
    attachments: [],
    constraints: [],
    ragInput: {},
    evidence: [],
    processState: null,
    persistentPrefs: null,
    progress: createDefaultProgressSignals(),
  };
}

describe("LanguageStage", () => {
  it("preenche ctx.language com idioma dominante", async () => {
    const ctx = makeContext("Faça uma análise detalhada desta dissertação, com linguagem acadêmica.");
    const stage = new LanguageStage();
    await stage.run(ctx);
    expect(ctx.language).toBeDefined();
    expect((ctx.language?.tag || "").toLowerCase().startsWith("pt")).toBe(true);
    expect(ctx.progress.stage).toBe("language");
  });

  it("usa fallback pt-BR quando confianca e baixa", async () => {
    const ctx = makeContext("oi");
    const stage = new LanguageStage();
    await stage.run(ctx);
    expect(ctx.language).toEqual({
      iso3: "por",
      tag: "pt-BR",
      confidence: 0.5,
    });
  });
});

