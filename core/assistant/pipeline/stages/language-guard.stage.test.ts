import { createDefaultProgressSignals } from "@/core/assistant/progress/progress-signals";
import type { PipelineContext } from "@/core/assistant/pipeline/pipeline-context";
import { LanguageGuardStage } from "@/core/assistant/pipeline/stages/language-guard.stage";

describe("LanguageGuardStage", () => {
  it("reescreve quando resposta final estiver em idioma diferente", async () => {
    let rewriteCalled = false;
    const ragService = {
      query: async () => {
        rewriteCalled = true;
        return { answer: "Texto corrigido em portugues.", metadata: {} };
      },
    } as any;
    const ctx: PipelineContext = {
      requestId: "req-guard",
      mode: "chat",
      stream: false,
      userMessage: "Faça análise em português.",
      conversation: [],
      attachments: [],
      constraints: [],
      ragInput: {},
      evidence: [],
      processState: null,
      persistentPrefs: null,
      language: { iso3: "por", tag: "pt-BR", confidence: 0.9 },
      progress: createDefaultProgressSignals(),
      finalAnswer: "This answer is in English and should be rewritten.",
    };

    const stage = new LanguageGuardStage(ragService);
    await stage.run(ctx);

    expect(rewriteCalled).toBe(true);
    expect(ctx.finalAnswer).toBe("Texto corrigido em portugues.");
  });

  it("reescreve em lite forçando override lite quando houver mismatch de idioma", async () => {
    let rewriteCalled = false;
    let receivedInput: Record<string, unknown> | null = null;
    const ragService = {
      query: async (input: Record<string, unknown>) => {
        rewriteCalled = true;
        receivedInput = input;
        return { answer: "Texto corrigido em portugues.", metadata: {} };
      },
    } as any;
    const ctx: PipelineContext = {
      requestId: "req-guard-lite",
      mode: "chat",
      stream: false,
      userMessage: "oi",
      conversation: [],
      attachments: [],
      constraints: [],
      ragInput: {},
      evidence: [],
      processState: null,
      persistentPrefs: null,
      language: { iso3: "por", tag: "pt-BR", confidence: 0.9 },
      progress: createDefaultProgressSignals(),
      finalAnswer: "This answer is in English and should be rewritten.",
      ragRuntimeMode: "lite",
    };

    const stage = new LanguageGuardStage(ragService);
    await stage.run(ctx);
    expect(rewriteCalled).toBe(true);
    expect((receivedInput as Record<string, unknown> | null)?.["pipelineModeOverride"]).toBe("lite");
  });
});
