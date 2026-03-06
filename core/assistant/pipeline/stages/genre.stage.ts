import { GenreDetectorService } from "@/core/assistant/genre/genre-detector.service";
import type { PipelineContext } from "@/core/assistant/pipeline/pipeline-context";
import type { Stage } from "@/core/assistant/pipeline/stages/stage.interface";
import { TemplateRegistry } from "@/core/assistant/templates/template-registry";

const FALLBACK_LANG = process.env.ACADEMIC_DEFAULT_LANG || "pt-BR";

export class GenreStage implements Stage {
  constructor(
    private readonly detector = new GenreDetectorService(),
    private readonly templates = new TemplateRegistry(),
  ) {}

  async run(ctx: PipelineContext) {
    ctx.progress.stage = "genre";
    const detection = this.detector.detect({
      message: ctx.userMessage,
      conversation: ctx.conversation,
      intentType: ctx.intent?.type,
    });
    ctx.genre = detection.genre;
    ctx.genreConfidence = detection.confidence;
    const languageTag = `${ctx.language?.tag || FALLBACK_LANG}`.trim() || FALLBACK_LANG;
    ctx.templateSpec = this.templates.getTemplate(detection.genre, languageTag);
    if (ctx.templateSpec.rules.noInvention && !ctx.constraints.includes("sem_inventar")) {
      ctx.constraints.push("sem_inventar");
    }
  }
}
