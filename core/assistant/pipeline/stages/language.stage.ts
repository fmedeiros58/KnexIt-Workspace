import { dominantLanguageFromTexts } from "@/core/assistant/language/language.utils";
import type { PipelineContext } from "@/core/assistant/pipeline/pipeline-context";
import type { Stage } from "@/core/assistant/pipeline/stages/stage.interface";

export class LanguageStage implements Stage {
  async run(ctx: PipelineContext) {
    ctx.progress.stage = "language";
    const historyTail = (ctx.conversation || [])
      .slice(-4)
      .map((row) => `${row.content || ""}`.trim())
      .filter(Boolean);
    const dominant = dominantLanguageFromTexts([ctx.userMessage || "", ...historyTail]);
    if (!dominant || dominant.iso3 === "und" || dominant.confidence < 0.4) {
      ctx.language = {
        iso3: "por",
        tag: "pt-BR",
        confidence: 0.5,
      };
      return;
    }
    ctx.language = dominant;
  }
}

