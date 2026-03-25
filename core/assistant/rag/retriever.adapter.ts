import type { EvidenceItem, PipelineContext } from "@/core/assistant/pipeline/pipeline-context";
import { createQueryEmbeddingClient, type QueryEmbeddingClient } from "@/core/rag/embedding-client";
import { createDocumentFullTextService, type DocumentFullTextService } from "@/core/rag/document-fulltext-service";
import { createRagInternetSearchService, type InternetSearchResponse, type RagInternetSearchService } from "@/core/rag/internet-search-service";
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

function parseOptionalBoolean(value: string | undefined | null): boolean | undefined {
  const normalized = `${value || ""}`.trim().toLowerCase();
  if (!normalized) return undefined;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return undefined;
}

function normalizeForVerification(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isVerifiableQuestionForAutoSearch(prompt: string) {
  const normalized = normalizeForVerification(prompt);
  if (!normalized) return false;
  const asksCurrentOffice =
    /\b(reitor|reitora|presidente|prefeito|governador|ministro|secretario|diretor|ceo|rector|chancellor)\b/.test(
      normalized,
    ) && /\b(quem|who|qual|nome|current|atual|hoje|agora)\b/.test(normalized);
  const asksVerifiableData =
    /\b(data|ano|numero|percentual|taxa|fonte|citacao|referencia|lei|norma|resolucao|preco|valor|dosagem|dose|mg|ml)\b/.test(
      normalized,
    );
  return asksCurrentOffice || asksVerifiableData;
}

function isCurrentOfficeQuestion(prompt: string) {
  const normalized = normalizeForVerification(prompt);
  if (!normalized) return false;
  return (
    /\b(reitor|reitora|presidente|prefeito|governador|ministro|secretario|diretor|ceo|rector|chancellor)\b/.test(
      normalized,
    ) && /\b(quem|who|qual|nome|current|atual|hoje|agora)\b/.test(normalized)
  );
}

function isUsOfficeQuestion(prompt: string) {
  const normalized = normalizeForVerification(prompt);
  if (!normalized) return false;
  return /\b(estados unidos|eua|usa|united states|u\.s\.)\b/.test(normalized);
}

function isBrazilOfficeQuestion(prompt: string) {
  const normalized = normalizeForVerification(prompt);
  if (!normalized) return false;
  return /\b(brasil|brazil|acre|sao paulo|rio de janeiro|minas gerais|bahia|parana|goias|amazonas|estado)\b/.test(
    normalized,
  );
}

function isForceMultiSourceWebSearchEnabled() {
  return parseOptionalBoolean(process.env.KNEXAI_FORCE_MULTI_SOURCE_WEB_SEARCH) !== false;
}

function hasMeaningfulSearchScopeForAutoSearch(value: string) {
  const normalized = normalizeForVerification(value);
  if (!normalized) return false;
  if (
    /\b(presidente|prefeito|governador|ministro|reitor|ceo|rector|chancellor|usa|eua|united states|estados unidos|brasil|brazil|acre)\b/.test(
      normalized,
    )
  ) {
    return true;
  }
  const stopwords = new Set([
    "a",
    "as",
    "atual",
    "current",
    "da",
    "das",
    "de",
    "do",
    "dos",
    "e",
    "eh",
    "is",
    "me",
    "nome",
    "o",
    "of",
    "os",
    "qual",
    "que",
    "quem",
    "saber",
    "the",
  ]);
  const tokens = normalized
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !stopwords.has(token));
  return tokens.length >= 2;
}

function stripAutoSearchPreamble(prompt: string) {
  let value = `${prompt || ""}`.trim().replace(/\s+/g, " ");
  if (!value) return "";
  const patterns = [
    /^(?:por favor[,:\s-]*)?(?:preciso|quero|gostaria)\s+que\s+(?:voce|vc)\s+(?:me\s+)?(?:diga|informe|responda)\s+/i,
    /^(?:por favor[,:\s-]*)?(?:preciso|quero|gostaria)\s+que\s+(?:me\s+)?(?:diga|informe|responda)\s+/i,
    /^(?:por favor[,:\s-]*)?(?:preciso|quero|gostaria)\s+que\s+(?:voce|vc)\s+(?:me\s+)?d(?:e|ê)\s+o\s+nome\s+(?:do|da|de)\s+/i,
    /^(?:por favor[,:\s-]*)?(?:preciso|quero|gostaria)\s+que\s+(?:me\s+)?d(?:e|ê)\s+o\s+nome\s+(?:do|da|de)\s+/i,
    /^(?:por favor[,:\s-]*)?(?:preciso|quero|gostaria)\s+saber\s+(?:o\s+nome\s+)?(?:do|da|de)\s+/i,
    /^(?:por favor[,:\s-]*)?(?:voce|vc)\s+pode\s+(?:me\s+)?(?:dizer|informar|responder)\s+/i,
    /^(?:por favor[,:\s-]*)?pode\s+(?:me\s+)?(?:dizer|informar|responder)\s+/i,
    /^(?:por favor[,:\s-]*)?me\s+(?:diga|informe|responda)\s+/i,
    /^(?:qual\s+(?:e|eh|é)\s+(?:o|a)\s+nome\s+(?:do|da|de)\s+)/i,
    /^(?:qual\s+o\s+nome\s+(?:do|da|de)\s+)/i,
    /^(?:quem\s+(?:e|eh|é)\s+(?:o|a)\s+)/i,
  ];
  for (const pattern of patterns) {
    value = value.replace(pattern, "");
  }
  const stripped = value.trim();
  if (!stripped) return "";
  return hasMeaningfulSearchScopeForAutoSearch(stripped) ? stripped : `${prompt || ""}`.trim();
}

function buildAutoSearchQueries(prompt: string) {
  const raw = `${prompt || ""}`.trim();
  if (!raw) return [];
  const base = stripAutoSearchPreamble(raw) || raw;
  const maxQueries = Number.isFinite(Number(process.env.KNEXAI_AUTO_WEB_SEARCH_QUERIES))
    ? Math.max(1, Math.min(5, Math.trunc(Number(process.env.KNEXAI_AUTO_WEB_SEARCH_QUERIES))))
    : 4;
  const asksCurrentOffice = isCurrentOfficeQuestion(base);
  const asksUsOffice = asksCurrentOffice && isUsOfficeQuestion(base);
  const asksBrazilOffice = asksCurrentOffice && isBrazilOfficeQuestion(base);
  const candidates = asksUsOffice
    ? [
        base,
        "current president of the united states site:whitehouse.gov",
        `${base} site:wikipedia.org`,
        "president of the united states wikipedia incumbent",
        "current president of the united states site:reuters.com",
        "current president of the united states site:apnews.com",
        `${base} site:whitehouse.gov`,
        `${base} site:reuters.com`,
        `${base} site:apnews.com`,
        `${base} site:bbc.com`,
        `${base} site:wikipedia.org`,
        `${base} latest`,
        `${base} atualizado`,
      ]
    : asksBrazilOffice
      ? [
          `${base} site:gov.br`,
          `${base} site:agenciabrasil.ebc.com.br`,
          `${base} site:wikipedia.org`,
          `${base} site:g1.globo.com`,
          `${base} site:uol.com.br`,
          `${base} site:cnnbrasil.com.br`,
          base,
          `${base} atualizado`,
        ]
      : [base, `${base} site:gov.br`, `${base} site:wikipedia.org`, `${base} atualizado`];
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const query of candidates) {
    const normalized = query.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(query.trim());
    if (unique.length >= maxQueries) break;
  }
  return unique;
}

function dedupeUrls(results: Array<InternetSearchResponse["results"][number]>, maxItems: number) {
  const unique: Array<InternetSearchResponse["results"][number]> = [];
  const seen = new Set<string>();
  for (const row of results) {
    const url = `${row.url || ""}`.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    unique.push(row);
    if (unique.length >= maxItems) break;
  }
  return unique;
}

function isLowSignalDomain(url: string) {
  let hostname = "";
  try {
    hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return false;
  }
  if (!hostname) return false;
  return (
    hostname.includes("dicio.com.br") ||
    hostname.includes("sinonimos.com.br") ||
    hostname.includes("dicionario.priberam.org") ||
    hostname.includes("dicionario.info") ||
    hostname.includes("portuguesaletra.com")
  );
}

export class RetrieverAdapter {
  constructor(
    private readonly embeddingClient: QueryEmbeddingClient = createQueryEmbeddingClient(),
    private readonly retrievalService: RagRetrievalService = createRagRetrievalService(),
    private readonly documentFullTextService: DocumentFullTextService = createDocumentFullTextService(),
    private readonly internetSearchService: RagInternetSearchService = createRagInternetSearchService(),
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
    if (isForceMultiSourceWebSearchEnabled()) return true;
    if (ctx.attachments.length > 0) return true;
    if (ctx.ragInput.documentId || (ctx.ragInput.documentIds || []).length > 0) return true;
    const normalized = normalize(ctx.userMessage);
    return (
      /\b(analise|resenha|documento|arquivo|fonte|evidencia|cite|referencia)\b/.test(normalized) ||
      isVerifiableQuestionForAutoSearch(ctx.userMessage)
    );
  }

  seedEvidenceFromAttachments(ctx: PipelineContext): EvidenceItem[] {
    return ctx.attachments.map((attachment, idx) => ({
      source: "file",
      ref: attachment.id || `${idx + 1}`,
      score: 1,
      text: attachment.name || `arquivo-${idx + 1}`,
    }));
  }

  private async buildAutomaticWebEvidence(query: string): Promise<EvidenceItem[]> {
    const autoEnabled = parseOptionalBoolean(process.env.KNEXAI_AUTO_WEB_SEARCH_ENABLED) !== false;
    if (!autoEnabled) return [];
    if (!this.internetSearchService.isEnabled()) return [];
    const forceMultiSource = isForceMultiSourceWebSearchEnabled();
    if (!forceMultiSource && !isVerifiableQuestionForAutoSearch(query)) return [];
    const queries = buildAutoSearchQueries(query);
    if (!queries.length) return [];

    const allResults: Array<InternetSearchResponse["results"][number]> = [];
    const payloads = await Promise.allSettled(
      queries.map((currentQuery) => this.internetSearchService.search({ query: currentQuery, preferPdf: false })),
    );
    for (let index = 0; index < payloads.length; index += 1) {
      const result = payloads[index];
      const currentQuery = queries[index] || "";
      if (result.status === "rejected") {
        logger.warn("ASSISTANT_AUTO_WEB_QUERY_FAILED", {
          query: currentQuery,
          message: result.reason instanceof Error ? result.reason.message : "unknown_error",
        });
        continue;
      }
      const payload = result.value;
      if (!payload?.results?.length) continue;
      allResults.push(...payload.results);
    }
    if (!allResults.length) {
      if (!forceMultiSource) return [];
      return [
        {
          source: "memory",
          ref: "web:missing",
          score: 1,
          text: "[WEB_REQUIRED] Nenhuma fonte web foi recuperada agora. Nao responda com fatos por memoria; informe que a verificacao web falhou e solicite nova tentativa.",
        },
      ];
    }
    const maxResults = Number.isFinite(Number(process.env.KNEXAI_AUTO_WEB_SEARCH_MAX_RESULTS))
      ? Math.max(2, Math.min(12, Math.trunc(Number(process.env.KNEXAI_AUTO_WEB_SEARCH_MAX_RESULTS))))
      : 6;
    let selected = dedupeUrls(allResults, maxResults);
    const highSignalSelected = selected.filter((row) => !isLowSignalDomain(`${row.url || ""}`));
    if (highSignalSelected.length) {
      selected = highSignalSelected;
    }
    if (!selected.length) {
      if (!forceMultiSource) return [];
      return [
        {
          source: "memory",
          ref: "web:missing",
          score: 1,
          text: "[WEB_REQUIRED] Nenhuma fonte web foi recuperada agora. Nao responda com fatos por memoria; informe que a verificacao web falhou e solicite nova tentativa.",
        },
      ];
    }
    return selected.map((row, index) => ({
      source: "rag" as const,
      ref: `web:${index + 1}`,
      score: Math.max(0.42, 0.78 - index * 0.06),
      text: `[WEB] ${row.title || `Fonte ${index + 1}`} | URL: ${row.url} | ${`${row.snippet || ""}`.trim()}`.slice(0, 1200),
    }));
  }

  async search(input: { query: string; conversation: PipelineContext["conversation"]; ctx: PipelineContext }): Promise<EvidenceItem[]> {
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
    const webEvidence = await this.buildAutomaticWebEvidence(query);

    if (!query) {
      if (strictScopedDocIds.length > 0) {
        const scopedFallback = await this.buildScopedDocumentFallbackEvidence(strictScopedDocIds, topK);
        if (scopedFallback.length > 0) return [...webEvidence, ...scopedFallback];
      }
      return [...webEvidence, ...fallbackEvidenceFromConversation(input.ctx)];
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

      const evidence: EvidenceItem[] = retrieval.hits.slice(0, topK).map((hit) => ({
        source: "rag" as const,
        ref: `doc:${hit.documentId}:chunk:${hit.chunkId}`,
        score: Number.isFinite(hit.score) ? hit.score : Math.max(0, 1 - Number(hit.distance || 1)),
        text: `${hit.text || ""}`.replace(/\s+/g, " ").trim().slice(0, 1200),
      }));
      if (evidence.length > 0) return [...webEvidence, ...evidence];
      if (strictScopedDocIds.length > 0) {
        const scopedFallback = await this.buildScopedDocumentFallbackEvidence(strictScopedDocIds, topK);
        if (scopedFallback.length > 0) return [...webEvidence, ...scopedFallback];
        return [
          ...webEvidence,
          {
            source: "memory",
            ref: `docscope:${strictScopedDocIds.join(",")}:missing`,
            score: 0.2,
            text: "Nao foi possivel recuperar trechos do documento anexado. Informe para o usuario revisar a ingestao/indexacao do arquivo.",
          },
        ];
      }
      if (webEvidence.length > 0) return webEvidence;
      return fallbackEvidenceFromConversation(input.ctx);
    } catch (error) {
      if (strictScopedDocIds.length > 0) {
        const scopedFallback = await this.buildScopedDocumentFallbackEvidence(strictScopedDocIds, topK);
        if (scopedFallback.length > 0) return [...webEvidence, ...scopedFallback];
        logger.warn("ASSISTANT_SCOPED_DOC_RETRIEVAL_FAILED", {
          documentIds: strictScopedDocIds,
          message: error instanceof Error ? error.message : "unknown_error",
        });
        return [
          ...webEvidence,
          {
            source: "memory",
            ref: `docscope:${strictScopedDocIds.join(",")}:error`,
            score: 0.2,
            text: "Nao foi possivel consultar o conteudo do documento anexado nesta tentativa. Priorize transparencia e evite respostas desconectadas do arquivo.",
          },
        ];
      }
      if (webEvidence.length > 0) return webEvidence;
      return fallbackEvidenceFromConversation(input.ctx);
    }
  }
}

