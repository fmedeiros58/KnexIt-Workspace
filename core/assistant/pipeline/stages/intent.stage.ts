import type { PipelineContext } from "@/core/assistant/pipeline/pipeline-context";
import type { Stage } from "@/core/assistant/pipeline/stages/stage.interface";

function normalize(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

export class IntentStage implements Stage {
  async run(ctx: PipelineContext) {
    ctx.progress.stage = "intent";
    const message = normalize(ctx.userMessage);
    let type = "general";
    let confidence = 0.62;
    if (/\b(traduz|translate|translation)\b/.test(message)) {
      type = "translation";
      confidence = 0.9;
    } else if (/\b(resenha|analise|critica|compare|disserta|tese|obra)\b/.test(message)) {
      type = "analysis";
      confidence = 0.86;
    } else if (/\b(resuma|resumo|sintese)\b/.test(message)) {
      type = "summary";
      confidence = 0.83;
    } else if (/\b(plano|roteiro|passo a passo|estrategia)\b/.test(message)) {
      type = "planning";
      confidence = 0.78;
    }
    ctx.intent = { type, confidence };
    ctx.progress.intentDetected = true;
  }
}
