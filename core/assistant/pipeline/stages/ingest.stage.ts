import type { PipelineContext } from "@/core/assistant/pipeline/pipeline-context";
import type { Stage } from "@/core/assistant/pipeline/stages/stage.interface";

function extractConstraints(message: string) {
  const normalized = `${message || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  const constraints: string[] = [];
  if (/\bnao citar\b/.test(normalized)) constraints.push("nao_citar");
  if (/\bsem fugir do escopo\b/.test(normalized)) constraints.push("sem_fuga_escopo");
  if (/\bsem inventar\b/.test(normalized)) constraints.push("sem_inventar");
  return constraints;
}

export class IngestStage implements Stage {
  async run(ctx: PipelineContext) {
    ctx.progress.stage = "ingest";
    ctx.userMessage = `${ctx.userMessage || ""}`.trim();
    ctx.constraints = [...ctx.constraints, ...extractConstraints(ctx.userMessage)];
    ctx.progress.ingested = true;
  }
}
