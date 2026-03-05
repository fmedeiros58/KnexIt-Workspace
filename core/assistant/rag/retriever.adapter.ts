import type { EvidenceItem, PipelineContext } from "@/core/assistant/pipeline/pipeline-context";
import { createQueryEmbeddingClient, type QueryEmbeddingClient } from "@/core/rag/embedding-client";
import { createRagRetrievalService, type RagRetrievalService } from "@/core/rag/retrieval-service";

function normalize(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function parsePositiveInt(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  const rounded = Math.round(parsed);
  return rounded > 0 ? rounded : undefined;
}

function normalizeDocumentIds(values: unknown, maxItems = 64) {
  if (!Array.isArray(values)) return [] as number[];
  const normalized: number[] = [];
  const seen = new Set<number>();
  for (const raw of values) {
    const parsed = parsePositiveInt(raw);
    if (!parsed || seen.has(parsed)) continue;
    seen.add(parsed);
    normalized.push(parsed);
    if (normalized.length >= maxItems) break;
  }
  return normalized;
}

function extractDocumentIdsFromAttachments(ctx: PipelineContext) {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const attachment of ctx.attachments) {
    const parsed = parsePositiveInt(attachment.id);
    if (!parsed || seen.has(parsed)) continue;
    seen.add(parsed);
    ids.push(parsed);
  }
  return ids;
}

function fallbackEvidenceFromConversation(ctx: PipelineContext): EvidenceItem[] {
  const tail = [...ctx.conversation].slice(-4);
  return tail.map((row, idx) => ({
    source: "memory",
    ref: `conversation:${idx + 1}`,
    score: 0.45,
    text: row.content.slice(0, 400),
  }));
}

export class RetrieverAdapter {
  constructor(
    private readonly embeddingClient: QueryEmbeddingClient = createQueryEmbeddingClient(),
    private readonly retrievalService: RagRetrievalService = createRagRetrievalService(),
  ) {}

  shouldRetrieve(ctx: PipelineContext) {
    if (ctx.attachments.length > 0) return true;
    if (ctx.ragInput.documentId || (ctx.ragInput.documentIds || []).length > 0) return true;
    const normalized = normalize(ctx.userMessage);
    return /\b(analise|resenha|documento|arquivo|fonte|evidencia|cite|referencia)\b/.test(normalized);
  }

  seedEvidenceFromAttachments(ctx: PipelineContext): EvidenceItem[] {
    return ctx.attachments.map((attachment, idx) => ({
      source: "file",
      ref: attachment.id || `${idx + 1}`,
      score: 1,
      text: attachment.name || `arquivo-${idx + 1}`,
    }));
  }

  async search(input: { query: string; conversation: PipelineContext["conversation"]; ctx: PipelineContext }) {
    const query = `${input.query || ""}`.trim();
    if (!query) return fallbackEvidenceFromConversation(input.ctx);

    const scopedDocumentIds = normalizeDocumentIds(input.ctx.ragInput.documentIds);
    const scopedComposerIds = normalizeDocumentIds(input.ctx.ragInput.composerAttachmentIds);
    const scopedAttachmentIds = extractDocumentIdsFromAttachments(input.ctx);
    const mergedScopeIds = Array.from(new Set([...scopedDocumentIds, ...scopedComposerIds, ...scopedAttachmentIds]));
    const documentId = parsePositiveInt(input.ctx.ragInput.documentId);
    const topK = parsePositiveInt(input.ctx.ragInput.topK) || 8;
    const maxDistanceRaw = input.ctx.ragInput.maxDistance;
    const maxDistance = maxDistanceRaw === null ? null : Number.isFinite(Number(maxDistanceRaw)) ? Number(maxDistanceRaw) : undefined;
    const sourceType = typeof input.ctx.ragInput.sourceType === "string" ? input.ctx.ragInput.sourceType : undefined;
    const embeddingModel =
      typeof input.ctx.ragInput.retrievalEmbeddingModel === "string" ? input.ctx.ragInput.retrievalEmbeddingModel : undefined;

    try {
      const embedding = await this.embeddingClient.embedQuery(query);
      const retrieval = await this.retrievalService.search({
        queryVector: embedding.vector,
        topK,
        maxDistance,
        documentId,
        documentIds: mergedScopeIds.length ? mergedScopeIds : undefined,
        sourceType,
        embeddingModel,
      });

      const evidence = retrieval.hits.slice(0, topK).map((hit) => ({
        source: "rag" as const,
        ref: `doc:${hit.documentId}:chunk:${hit.chunkId}`,
        score: Number.isFinite(hit.score) ? hit.score : Math.max(0, 1 - Number(hit.distance || 1)),
        text: `${hit.text || ""}`.replace(/\s+/g, " ").trim().slice(0, 1200),
      }));
      if (evidence.length > 0) return evidence;
      return fallbackEvidenceFromConversation(input.ctx);
    } catch {
      return fallbackEvidenceFromConversation(input.ctx);
    }
  }
}
