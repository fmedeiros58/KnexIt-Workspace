import { AcademicGenre } from "@/core/assistant/genre/academic-genre.types";
import type { PipelineContext } from "@/core/assistant/pipeline/pipeline-context";
import { GenreStage } from "@/core/assistant/pipeline/stages/genre.stage";
import { createDefaultProgressSignals } from "@/core/assistant/progress/progress-signals";

describe("GenreStage", () => {
  it("define genero e template em modo write", async () => {
    const stage = new GenreStage();
    const ctx: PipelineContext = {
      requestId: "req-genre",
      conversationKey: "test-genre",
      mode: "write",
      stream: false,
      userMessage: "Elabore uma revisao sistematica com PRISMA e criterios de inclusao/exclusao.",
      conversation: [],
      constraints: [],
      intent: { type: "analysis", confidence: 0.85 },
      attachments: [],
      ragInput: {},
      evidence: [],
      processState: null,
      persistentPrefs: null,
      language: { iso3: "por", tag: "pt-BR", confidence: 0.91 },
      progress: createDefaultProgressSignals(),
    };

    await stage.run(ctx);

    expect(ctx.genre).toBe(AcademicGenre.SYSTEMATIC_REVIEW);
    expect(ctx.templateSpec?.id).toContain("systematic_review");
    expect(ctx.constraints).toContain("sem_inventar");
    expect(ctx.progress.stage).toBe("genre");
  });

  it("em modo chat nao injeta template academico", async () => {
    const stage = new GenreStage();
    const ctx: PipelineContext = {
      requestId: "req-genre-chat",
      conversationKey: "test-genre-chat",
      mode: "chat",
      stream: false,
      userMessage: "Oi, como voce esta?",
      conversation: [],
      constraints: [],
      intent: { type: "general", confidence: 0.72 },
      attachments: [],
      ragInput: {},
      evidence: [],
      processState: null,
      persistentPrefs: null,
      language: { iso3: "por", tag: "pt-BR", confidence: 0.91 },
      progress: createDefaultProgressSignals(),
    };

    await stage.run(ctx);

    expect(ctx.templateSpec).toBeUndefined();
    expect(ctx.constraints).toContain("sem_fuga_escopo");
    expect(ctx.constraints).toContain("nao_metalinguagem");
  });
});
