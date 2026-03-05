import { EvidenceStore } from "@/core/assistant/memory/evidence.store";
import type { PipelineContext } from "@/core/assistant/pipeline/pipeline-context";
import type { Stage } from "@/core/assistant/pipeline/stages/stage.interface";
import { RetrieverAdapter } from "@/core/assistant/rag/retriever.adapter";

export class RetrievalStage implements Stage {
  constructor(
    private readonly retriever = new RetrieverAdapter(),
    private readonly evidenceStore = new EvidenceStore(),
  ) {}

  async run(ctx: PipelineContext) {
    ctx.progress.stage = "retrieval";
    const seeded = this.retriever.seedEvidenceFromAttachments(ctx);
    if (seeded.length > 0) {
      ctx.evidence.push(...seeded);
      ctx.progress.readFiles = true;
    }

    const shouldRetrieve = this.retriever.shouldRetrieve(ctx);
    if (!shouldRetrieve) {
      await this.evidenceStore.save(ctx.requestId, ctx.evidence);
      return;
    }
    const retrieved = await this.retriever.search({
      query: ctx.userMessage,
      conversation: ctx.conversation,
      ctx,
    });
    if (Array.isArray(retrieved) && retrieved.length > 0) {
      const existing = new Set(ctx.evidence.map((row) => `${row.source}:${row.ref}:${row.text.slice(0, 120)}`));
      for (const row of retrieved) {
        const key = `${row.source}:${row.ref}:${row.text.slice(0, 120)}`;
        if (existing.has(key)) continue;
        existing.add(key);
        ctx.evidence.push(row);
      }
    }
    ctx.progress.usedRag = ctx.evidence.some((row) => row.source === "rag");
    await this.evidenceStore.save(ctx.requestId, ctx.evidence);
  }
}
