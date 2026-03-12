import type { EvidenceItem, PipelineContext } from "@/core/assistant/pipeline/pipeline-context";
import { createQueryEmbeddingClient, type QueryEmbeddingClient } from "@/core/rag/embedding-client";
import { createDocumentFullTextService, type DocumentFullTextService } from "@/core/rag/document-fulltext-service";
import { createRagRetrievalService, type RagRetrievalService } from "@/core/rag/retrieval-service";
import { logger } from "@/core/utils/logger";

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
    private readonly documentFullTextService: DocumentFullTextService = createDocumentFullTextService(),
  ) {}

  private async buildScopedDocumentFallbackEvidence(documentIds: number[], topK: number): Promise<EvidenceItem[]> {
    if (!documentIds.length) return [];
    try {
      const context = await this.documentFullTextService.buildContextFromDocumentIds(documentIds);
      const normalized = `${context.text || ""}`.replace(/\s+/g, " ").trim();
      if (!normalized) return [];

      const maxItems = Math.max(1, Math.min(4, topK));
      const chunkSize = 1_200;
      const evidence: EvidenceItem[] = [];
      for (let cursor = 0; cursor < normalized.length && evidence.length < maxItems; cursor += chunkSize) {
        const slice = normalized.slice(cursor, cursor + chunkSize).trim();
        if (!slice) continue;
        evidence.push({
          source: "rag",
          ref: `docscope:${documentIds.join(",")}:fulltext:${evidence.length + 1}`,
          score: Math.max(0.25, 0.64 - evidence.length * 0.08),
          text: slice,
        });
      }
      return evidence;
    } catch (error) {
      logger.warn("ASSISTANT_SCOPED_DOC_FALLBACK_FAILED", {
        documentIds,
        message: error instanceof Error ? error.message : "unknown_error",
      });
      return [];
    }
  }

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
    const scopedDocumentIds = normalizeDocumentIds(input.ctx.ragInput.documentIds);
    const scopedComposerIds = normalizeDocumentIds(input.ctx.ragInput.composerAttachmentIds);
    const scopedAttachmentIds = extractDocumentIdsFromAttachments(input.ctx);
    const documentId = parsePositiveInt(input.ctx.ragInput.documentId);
    const mergedScopeIds = Array.from(new Set([...scopedDocumentIds, ...scopedComposerIds, ...scopedAttachmentIds]));
    const strictScopedDocIds = Array.from(new Set([...(documentId ? [documentId] : []), ...mergedScopeIds]));
    const topK = parsePositiveInt(input.ctx.ragInput.topK) || 8;
    const maxDistanceRaw = input.ctx.ragInput.maxDistance;
    const maxDistance = maxDistanceRaw === null ? null : Number.isFinite(Number(maxDistanceRaw)) ? Number(maxDistanceRaw) : undefined;
    const sourceType = typeof input.ctx.ragInput.sourceType === "string" ? input.ctx.ragInput.sourceType : undefined;
    const embeddingModel =
      typeof input.ctx.ragInput.retrievalEmbeddingModel === "string" ? input.ctx.ragInput.retrievalEmbeddingModel : undefined;

    if (!query) {
      if (strictScopedDocIds.length > 0) {
        const scopedFallback = await this.buildScopedDocumentFallbackEvidence(strictScopedDocIds, topK);
        if (scopedFallback.length > 0) return scopedFallback;
      }
      return fallbackEvidenceFromConversation(input.ctx);
    }

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
      if (strictScopedDocIds.length > 0) {
        const scopedFallback = await this.buildScopedDocumentFallbackEvidence(strictScopedDocIds, topK);
        if (scopedFallback.length > 0) return scopedFallback;
        return [
          {
            source: "memory",
            ref: `docscope:${strictScopedDocIds.join(",")}:missing`,
            score: 0.2,
            text: "Nao foi possivel recuperar trechos do documento anexado. Informe para o usuario revisar a ingestao/indexacao do arquivo.",
          },
        ];
      }
      return fallbackEvidenceFromConversation(input.ctx);
    } catch (error) {
      if (strictScopedDocIds.length > 0) {
        const scopedFallback = await this.buildScopedDocumentFallbackEvidence(strictScopedDocIds, topK);
        if (scopedFallback.length > 0) return scopedFallback;
        logger.warn("ASSISTANT_SCOPED_DOC_RETRIEVAL_FAILED", {
          documentIds: strictScopedDocIds,
          message: error instanceof Error ? error.message : "unknown_error",
        });
        return [
          {
            source: "memory",
            ref: `docscope:${strictScopedDocIds.join(",")}:error`,
            score: 0.2,
            text: "Nao foi possivel consultar o conteudo do documento anexado nesta tentativa. Priorize transparencia e evite respostas desconectadas do arquivo.",
          },
        ];
      }
      return fallbackEvidenceFromConversation(input.ctx);
    }
  }
}
