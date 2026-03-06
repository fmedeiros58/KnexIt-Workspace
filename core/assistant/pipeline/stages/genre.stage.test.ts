import { AcademicGenre } from "@/core/assistant/genre/academic-genre.types";
import type { PipelineContext } from "@/core/assistant/pipeline/pipeline-context";
import { GenreStage } from "@/core/assistant/pipeline/stages/genre.stage";
import { createDefaultProgressSignals } from "@/core/assistant/progress/progress-signals";

describe("GenreStage", () => {
  it("define genero e template com base na mensagem", async () => {
    const stage = new GenreStage();
    const ctx: PipelineContext = {
      requestId: "req-genre",
      mode: "chat",
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
});
