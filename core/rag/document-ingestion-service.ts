import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { PoolClient } from "pg";

import { loadRagIngestionConfig, type RagIngestionConfig } from "../config/env";
import { loadPathConfig, type PathConfig } from "../config/paths";
import { createVectorDatabaseClient, type VectorDatabaseClient } from "../database/vector-client";
import { logger } from "../utils/logger";
import { ChunkEmbeddingService } from "./chunk-embedding-service";
import { chunkTextDeterministic, type TextChunk } from "./chunking";
import {
  DocumentTextExtractionError,
  extractTextFromDocument,
  UnsupportedDocumentTypeError,
} from "./text-extractor";

type JsonObject = Record<string, unknown>;

export type IngestionActor = {
  userId?: string | null;
  sessionId?: string | null;
  channel: "frontend" | "admin_bulk" | "system";
};

export type UploadIngestionInput = {
  kind: "upload";
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  title?: string;
  sourceType?: string;
  metadata?: JsonObject;
  actor: IngestionActor;
};

export type ReferenceIngestionInput = {
  kind: "reference";
  filePath: string;
  title?: string;
  sourceType?: string;
  metadata?: JsonObject;
  actor: IngestionActor;
};

export type DocumentIngestionInput = UploadIngestionInput | ReferenceIngestionInput;

export type DocumentIngestionResult = {
  jobId: number | null;
  documentId: number;
  duplicate: boolean;
  contentHash: string;
  sourceType: string;
  sourcePath: string;
  title: string | null;
  chunkCount: number;
  status: string;
  rawFilePath: string;
  extractedTextPath: string;
  parser: "utf8" | "docx" | "pdf";
  embeddingStatus: "completed" | "failed" | "pending";
};

export type IngestionJobDetails = {
  id: number;
  status: string;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  documentId: number | null;
  documentStatus: string | null;
  contentHash: string | null;
  sourceType: string | null;
  sourcePath: string | null;
};

export type DocumentDetailsResult = {
  id: number;
  sourceType: string;
  sourcePath: string;
  originalFilename: string | null;
  mimeType: string | null;
  contentHash: string;
  title: string | null;
  status: string;
  metadata: JsonObject;
  embeddingStatus: "completed" | "failed" | "pending";
  createdAt: string;
  updatedAt: string;
  totalChunks: number;
  embeddedChunks: number;
  ragReady: boolean;
  chunks: TextChunk[];
};

export class DocumentIngestionError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type MaterializedInput = {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  sourceType: string;
  sourceReferencePath: string;
};

type ExistingDocumentRow = {
  id: string | number;
  status: string;
  source_type: string;
  source_path: string;
  title: string | null;
  embedding_status: string | null;
  parser: string | null;
};

type DocumentRow = {
  id: string | number;
  source_type: string;
  source_path: string;
  original_filename: string | null;
  mime_type: string | null;
  content_hash: string;
  title: string | null;
  status: string;
  metadata: JsonObject | null;
  created_at: string;
  updated_at: string;
};

type ChunkRow = {
  chunk_index: string | number;
  text: string;
  token_count: string | number | null;
  char_start: string | number;
  char_end: string | number;
};

const DEFAULT_UPLOAD_SOURCE_TYPE = "user_upload";
const DEFAULT_REFERENCE_SOURCE_TYPE = "server_reference";
const MAX_DB_ERROR_MESSAGE = 512;

function toInteger(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function normalizeMetadata(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonObject;
}

function sanitizeFileName(fileName: string) {
  const normalized = fileName.trim().replace(/\s+/g, "-");
  const safe = normalized.replace(/[^a-zA-Z0-9._-]/g, "_");
  return safe || "document";
}

function sanitizePathSegment(value: string) {
  const safe = value.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  return safe || "anonymous";
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function normalizePathForDb(filePath: string) {
  return filePath.replace(/\\/g, "/");
}

function resolveAbsolutePath(rawPath: string) {
  if (!rawPath) return process.cwd();
  if (path.isAbsolute(rawPath)) return path.resolve(rawPath);
  return path.resolve(process.cwd(), rawPath);
}

function toRelativeIfInsideWorkspace(absolutePath: string) {
  const workspace = process.cwd();
  const relative = path.relative(workspace, absolutePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return normalizePathForDb(path.resolve(absolutePath));
  }
  return normalizePathForDb(relative);
}

function isWithinBase(basePath: string, candidatePath: string) {
  const relative = path.relative(basePath, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function summarizeDbError(error: unknown) {
  if (!error || typeof error !== "object") return "unknown_error";
  const candidate = error as { message?: string };
  const raw = typeof candidate.message === "string" ? candidate.message : "unknown_error";
  return raw.slice(0, MAX_DB_ERROR_MESSAGE);
}

function isUniqueContentHashViolation(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; constraint?: string };
  return candidate.code === "23505" && candidate.constraint === "documents_content_hash_unique_idx";
}

function isUndefinedTableError(error: unknown, tableName: string) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  if (candidate.code !== "42P01") return false;
  const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";
  return message.includes(tableName.toLowerCase());
}

function parseDocumentId(row: ExistingDocumentRow | null) {
  if (!row) return null;
  return toInteger(row.id, 0);
}

function normalizeEmbeddingStatus(value: unknown): "completed" | "failed" | "pending" {
  if (value === "completed" || value === "failed" || value === "pending") return value;
  return "pending";
}

function normalizeParser(value: unknown): "utf8" | "docx" | "pdf" {
  if (value === "docx" || value === "pdf" || value === "utf8") return value;
  return "utf8";
}

export type DocumentLookupOptions = {
  limit: number;
  offset: number;
};

export class DocumentIngestionService {
  private readonly pathConfig: PathConfig;
  private readonly ingestionConfig: RagIngestionConfig;
  private readonly chunkEmbeddingService: ChunkEmbeddingService;

  constructor(
    private readonly vectorDb: VectorDatabaseClient = createVectorDatabaseClient(),
    options?: {
      pathConfig?: PathConfig;
      ingestionConfig?: RagIngestionConfig;
      chunkEmbeddingService?: ChunkEmbeddingService;
    },
  ) {
    this.pathConfig = options?.pathConfig ?? loadPathConfig();
    this.ingestionConfig = options?.ingestionConfig ?? loadRagIngestionConfig();
    this.chunkEmbeddingService = options?.chunkEmbeddingService ?? new ChunkEmbeddingService(this.vectorDb);
  }

  async ingest(input: DocumentIngestionInput): Promise<DocumentIngestionResult> {
    const ingestionJobId = await this.createIngestionJob();
    let contentHash = "";

    try {
      const materialized = await this.materializeInput(input);
      this.assertFileSize(materialized.bytes.length);
      contentHash = createHash("sha256").update(materialized.bytes).digest("hex");

      logger.info("RAG_INGEST_START", {
        jobId: ingestionJobId,
        kind: input.kind,
        sourceType: materialized.sourceType,
        fileName: materialized.fileName,
        sizeBytes: materialized.bytes.length,
        contentHashPrefix: contentHash.slice(0, 12),
      });

      const existing = await this.findDocumentByContentHash(contentHash);
      if (existing) {
        const existingDocumentId = parseDocumentId(existing);
        if (!existingDocumentId) {
          throw new DocumentIngestionError(500, "INGEST_LOOKUP_FAILED", "Documento deduplicado encontrado sem id valido.");
        }
        await this.finishIngestionJob(ingestionJobId, "succeeded", existingDocumentId, null);
        logger.info("RAG_INGEST_DEDUP_HIT", {
          jobId: ingestionJobId,
          documentId: existingDocumentId,
          contentHashPrefix: contentHash.slice(0, 12),
          sourceType: existing.source_type,
        });
        return {
          jobId: ingestionJobId,
          documentId: existingDocumentId,
          duplicate: true,
          contentHash,
          sourceType: existing.source_type,
          sourcePath: existing.source_path,
          title: existing.title,
          chunkCount: 0,
          status: existing.status,
          rawFilePath: existing.source_path,
          extractedTextPath: "",
          parser: normalizeParser(existing.parser),
          embeddingStatus: normalizeEmbeddingStatus(existing.embedding_status),
        };
      }

      const actorSegment = this.resolveActorSegment(input.actor);
      const rawFilePath = await this.persistRawFile(materialized.fileName, contentHash, materialized.bytes, actorSegment);
      logger.info("RAG_INGEST_RAW_PERSISTED", {
        jobId: ingestionJobId,
        contentHashPrefix: contentHash.slice(0, 12),
        rawFilePath: toRelativeIfInsideWorkspace(rawFilePath),
      });
      let extracted = await extractTextFromDocument({
        bytes: materialized.bytes,
        fileName: materialized.fileName,
        mimeType: materialized.mimeType,
      });
      logger.info("RAG_INGEST_TEXT_EXTRACTED", {
        jobId: ingestionJobId,
        parser: extracted.parser,
        mimeType: extracted.mimeType,
        textChars: extracted.text.length,
      });

      if (!extracted.text.trim()) {
        if (extracted.parser === "pdf") {
          extracted = {
            ...extracted,
            text: [
              `Documento PDF anexado: ${materialized.fileName}.`,
              "Nao foi possivel extrair texto legivel automaticamente (provavel PDF escaneado/imagem).",
              "Sugestao: enviar versao com OCR ou arquivo TXT/DOCX para analise textual completa.",
            ].join("\n"),
          };
          logger.warn("RAG_INGEST_EMPTY_PDF_TEXT_FALLBACK", {
            jobId: ingestionJobId,
            fileName: materialized.fileName,
            contentHashPrefix: contentHash.slice(0, 12),
          });
        } else {
          throw new DocumentIngestionError(
            422,
            "INGEST_EMPTY_TEXT",
            "Nao foi possivel extrair texto util do documento informado.",
          );
        }
      }

      const chunks = chunkTextDeterministic({
        text: extracted.text,
        chunkSizeChars: this.ingestionConfig.chunkSizeChars,
        chunkOverlapChars: this.ingestionConfig.chunkOverlapChars,
        maxChunksPerDocument: this.ingestionConfig.maxChunksPerDocument,
      });
      logger.info("RAG_INGEST_CHUNKING_DONE", {
        jobId: ingestionJobId,
        chunkCount: chunks.length,
        chunkSizeChars: this.ingestionConfig.chunkSizeChars,
        chunkOverlapChars: this.ingestionConfig.chunkOverlapChars,
      });

      if (!chunks.length) {
        throw new DocumentIngestionError(
          422,
          "INGEST_EMPTY_CHUNKS",
          "Documento extraido sem chunks validos apos o processamento.",
        );
      }

      const extractedTextPath = await this.persistExtractedText(contentHash, extracted.text);
      const sourcePathForDb = toRelativeIfInsideWorkspace(rawFilePath);
      const referencePathForDb = toRelativeIfInsideWorkspace(materialized.sourceReferencePath);
      const title = this.normalizeTitle(input.title, materialized.fileName);
      const metadata = {
        actor: {
          user_id: input.actor.userId || null,
          session_id: input.actor.sessionId || null,
          channel: input.actor.channel,
        },
        ingestion: {
          parser: extracted.parser,
          job_id: ingestionJobId,
          chunk_size_chars: this.ingestionConfig.chunkSizeChars,
          chunk_overlap_chars: this.ingestionConfig.chunkOverlapChars,
          chunk_count: chunks.length,
          raw_file_path: sourcePathForDb,
          extracted_text_path: toRelativeIfInsideWorkspace(extractedTextPath),
          referenced_source_path: referencePathForDb,
          ingested_at: new Date().toISOString(),
          embedding_status: "pending",
        },
        original: {
          filename: materialized.fileName,
          mime_type: extracted.mimeType,
          size_bytes: materialized.bytes.length,
        },
        ...normalizeMetadata(input.metadata),
      } satisfies JsonObject;

      const insertResult = await this.insertDocumentWithChunks({
        sourceType: materialized.sourceType,
        sourcePath: sourcePathForDb,
        originalFilename: materialized.fileName,
        mimeType: extracted.mimeType,
        contentHash,
        title,
        metadata,
        chunks,
      });

      let embeddingStatus: "completed" | "failed" | "pending" = "pending";
      if (this.ingestionConfig.embedChunksOnIngest) {
        try {
          const embeddingResult = await this.chunkEmbeddingService.indexDocumentChunks(
            insertResult.documentId,
            this.ingestionConfig.embeddingBatchSize,
          );
          if (embeddingResult.status === "completed") {
            embeddingStatus = "completed";
          } else {
            embeddingStatus = "failed";
          }

          if (embeddingResult.status !== "completed" && this.ingestionConfig.requireEmbeddingsOnIngest) {
            throw new DocumentIngestionError(
              502,
              "INGEST_EMBEDDING_INDEX_FAILED",
              "Documento ingerido, mas a indexacao de embeddings falhou.",
            );
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Falha desconhecida na indexacao de embeddings.";
          logger.error("RAG_INGEST_EMBEDDING_ERROR", {
            jobId: ingestionJobId,
            documentId: insertResult.documentId,
            message,
          });
          embeddingStatus = "failed";
          if (this.ingestionConfig.requireEmbeddingsOnIngest) {
            throw new DocumentIngestionError(
              502,
              "INGEST_EMBEDDING_INDEX_FAILED",
              "Documento ingerido, mas a indexacao de embeddings falhou.",
            );
          }
        }
      }

      await this.finishIngestionJob(ingestionJobId, "succeeded", insertResult.documentId, null);
      logger.info("RAG_INGEST_SUCCESS", {
        jobId: ingestionJobId,
        documentId: insertResult.documentId,
        contentHashPrefix: contentHash.slice(0, 12),
        chunkCount: insertResult.chunkCount,
        sourceType: materialized.sourceType,
        embeddingStatus,
      });
      return {
        jobId: ingestionJobId,
        documentId: insertResult.documentId,
        duplicate: false,
        contentHash,
        sourceType: materialized.sourceType,
        sourcePath: sourcePathForDb,
        title,
        chunkCount: insertResult.chunkCount,
        status: "processed",
        rawFilePath: sourcePathForDb,
        extractedTextPath: toRelativeIfInsideWorkspace(extractedTextPath),
        parser: extracted.parser,
        embeddingStatus,
      };
    } catch (error) {
      if (contentHash && isUniqueContentHashViolation(error)) {
        const existing = await this.findDocumentByContentHash(contentHash);
        const existingDocumentId = parseDocumentId(existing);
        if (!existingDocumentId || !existing) {
          await this.finishIngestionJob(ingestionJobId, "failed", null, "Conflito de hash sem documento resolvido.");
          throw new DocumentIngestionError(
            500,
            "INGEST_CONFLICT_UNRESOLVED",
            "Conflito de hash detectado, mas nao foi possivel recuperar o documento existente.",
          );
        }
        await this.finishIngestionJob(ingestionJobId, "succeeded", existingDocumentId, null);
        logger.warn("RAG_INGEST_DEDUP_CONFLICT_RESOLVED", {
          jobId: ingestionJobId,
          documentId: existingDocumentId,
          contentHashPrefix: contentHash.slice(0, 12),
        });
        return {
          jobId: ingestionJobId,
          documentId: existingDocumentId,
          duplicate: true,
          contentHash,
          sourceType: existing.source_type,
          sourcePath: existing.source_path,
          title: existing.title,
          chunkCount: 0,
          status: existing.status,
          rawFilePath: existing.source_path,
          extractedTextPath: "",
          parser: normalizeParser(existing.parser),
          embeddingStatus: normalizeEmbeddingStatus(existing.embedding_status),
        };
      }

      const errorMessage = summarizeDbError(error);
      await this.finishIngestionJob(ingestionJobId, "failed", null, errorMessage);

      if (error instanceof DocumentIngestionError) {
        logger.warn("RAG_INGEST_VALIDATION_ERROR", {
          jobId: ingestionJobId,
          code: error.code,
          status: error.status,
          message: error.message,
        });
        throw error;
      }
      if (error instanceof UnsupportedDocumentTypeError) {
        const wrapped = new DocumentIngestionError(
          415,
          "INGEST_UNSUPPORTED_TYPE",
          `${error.message} Tipos suportados: text/plain, text/markdown, text/csv, application/json, application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document.`,
        );
        logger.warn("RAG_INGEST_UNSUPPORTED_TYPE", {
          jobId: ingestionJobId,
          mimeType: error.mimeType || "desconhecido",
          extension: error.extension || "sem-ext",
        });
        throw wrapped;
      }
      if (error instanceof DocumentTextExtractionError) {
        logger.warn("RAG_INGEST_TEXT_EXTRACT_FAILED", {
          jobId: ingestionJobId,
          mimeType: error.mimeType || "desconhecido",
          extension: error.extension || "sem-ext",
          causeMessage: error.causeMessage,
        });
        throw new DocumentIngestionError(422, "INGEST_TEXT_EXTRACT_FAILED", error.message);
      }
      logger.error("RAG_INGEST_INTERNAL_ERROR", {
        jobId: ingestionJobId,
        message: errorMessage,
      });
      throw new DocumentIngestionError(500, "INGEST_INTERNAL_ERROR", "Falha interna no pipeline de ingestao.");
    }
  }

  async ingestBulkByReference(
    sourcePaths: string[],
    input: {
      actor: IngestionActor;
      sourceType?: string;
      titlePrefix?: string;
      metadata?: JsonObject;
    },
  ) {
    logger.info("RAG_INGEST_BULK_START", {
      total: sourcePaths.length,
      sourceType: input.sourceType || DEFAULT_REFERENCE_SOURCE_TYPE,
      actorChannel: input.actor.channel,
    });
    const results: Array<{ sourcePath: string; ok: boolean; result?: DocumentIngestionResult; error?: string }> = [];
    for (const sourcePath of sourcePaths) {
      try {
        const result = await this.ingest({
          kind: "reference",
          filePath: sourcePath,
          actor: input.actor,
          sourceType: input.sourceType,
          title: input.titlePrefix ? `${input.titlePrefix} ${path.basename(sourcePath)}` : undefined,
          metadata: input.metadata,
        });
        results.push({ sourcePath, ok: true, result });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro desconhecido";
        logger.warn("RAG_INGEST_BULK_ITEM_FAILED", { sourcePath, message });
        results.push({ sourcePath, ok: false, error: message });
      }
    }
    logger.info("RAG_INGEST_BULK_DONE", {
      total: results.length,
      successCount: results.filter((item) => item.ok).length,
      failedCount: results.filter((item) => !item.ok).length,
    });
    return results;
  }

  async getIngestionJobById(jobId: number): Promise<IngestionJobDetails | null> {
    try {
      const { rows } = await this.vectorDb.query<{
        id: string | number;
        status: string;
        error_message: string | null;
        started_at: string | null;
        finished_at: string | null;
        created_at: string;
        document_id: string | number | null;
        document_status: string | null;
        content_hash: string | null;
        source_type: string | null;
        source_path: string | null;
      }>(
        `
        select
          j.id,
          j.status,
          j.error_message,
          j.started_at,
          j.finished_at,
          j.created_at,
          j.document_id,
          d.status as document_status,
          d.content_hash,
          d.source_type,
          d.source_path
        from vector_store.ingestion_jobs j
        left join vector_store.documents d on d.id = j.document_id
        where j.id = $1
        limit 1
        `,
        [jobId],
      );
      if (!rows.length) return null;
      const row = rows[0];
      return {
        id: toInteger(row.id),
        status: row.status,
        errorMessage: row.error_message,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        createdAt: row.created_at,
        documentId: row.document_id === null ? null : toInteger(row.document_id),
        documentStatus: row.document_status,
        contentHash: row.content_hash,
        sourceType: row.source_type,
        sourcePath: row.source_path,
      };
    } catch (error) {
      if (isUndefinedTableError(error, "vector_store.ingestion_jobs")) {
        throw new DocumentIngestionError(
          503,
          "INGEST_JOBS_TABLE_MISSING",
          "Tabela vector_store.ingestion_jobs indisponivel neste ambiente.",
        );
      }
      throw error;
    }
  }

  async getDocumentById(documentId: number, options: DocumentLookupOptions): Promise<DocumentDetailsResult | null> {
    const safeLimit = Math.max(1, Math.min(1000, options.limit));
    const safeOffset = Math.max(0, options.offset);

    const documentQuery = await this.vectorDb.query<DocumentRow>(
      `
      select
        d.id,
        d.source_type,
        d.source_path,
        d.original_filename,
        d.mime_type,
        d.content_hash,
        d.title,
        d.status,
        d.metadata,
        d.created_at,
        d.updated_at
      from vector_store.documents d
      where d.id = $1
      limit 1
      `,
      [documentId],
    );

    if (!documentQuery.rows.length) return null;
    const row = documentQuery.rows[0];

    const chunksQuery = await this.vectorDb.query<ChunkRow>(
      `
      select chunk_index, text, token_count, char_start, char_end
      from vector_store.document_chunks
      where document_id = $1
      order by chunk_index asc
      limit $2
      offset $3
      `,
      [documentId, safeLimit, safeOffset],
    );

    const countQuery = await this.vectorDb.query<{ total: string | number }>(
      "select count(*) as total from vector_store.document_chunks where document_id = $1",
      [documentId],
    );
    const embeddedCountQuery = await this.vectorDb.query<{ total: string | number }>(
      `
      select count(*) as total
      from vector_store.chunk_embeddings ce
      inner join vector_store.document_chunks dc
        on dc.id = ce.chunk_id
      where dc.document_id = $1
      `,
      [documentId],
    );

    const metadata = normalizeMetadata(row.metadata);
    const embeddingStatus = normalizeEmbeddingStatus(
      (metadata as Record<string, unknown>).embedding_status ??
        ((metadata as Record<string, unknown>).embeddingStatus as unknown),
    );
    const totalChunks = toInteger(countQuery.rows[0]?.total, 0);
    const embeddedChunks = toInteger(embeddedCountQuery.rows[0]?.total, 0);
    const ragReady = row.status === "processed" && embeddingStatus === "completed" && totalChunks > 0 && embeddedChunks >= totalChunks;

    return {
      id: toInteger(row.id),
      sourceType: row.source_type,
      sourcePath: row.source_path,
      originalFilename: row.original_filename,
      mimeType: row.mime_type,
      contentHash: row.content_hash,
      title: row.title,
      status: row.status,
      metadata,
      embeddingStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      totalChunks,
      embeddedChunks,
      ragReady,
      chunks: chunksQuery.rows.map((chunk) => ({
        chunkIndex: toInteger(chunk.chunk_index),
        text: chunk.text,
        tokenCount: chunk.token_count === null ? null : toInteger(chunk.token_count),
        charStart: toInteger(chunk.char_start),
        charEnd: toInteger(chunk.char_end),
      })),
    };
  }

  private async materializeInput(input: DocumentIngestionInput): Promise<MaterializedInput> {
    if (input.kind === "upload") {
      const fileName = sanitizeFileName(input.fileName || "upload.txt");
      return {
        fileName,
        mimeType: input.mimeType || "",
        bytes: input.bytes,
        sourceType: (input.sourceType || DEFAULT_UPLOAD_SOURCE_TYPE).trim().toLowerCase(),
        sourceReferencePath: fileName,
      };
    }

    const absolutePath = this.resolveReferencePath(input.filePath);
    const bytes = await readFile(absolutePath);
    return {
      fileName: sanitizeFileName(path.basename(absolutePath)),
      mimeType: "",
      bytes,
      sourceType: (input.sourceType || DEFAULT_REFERENCE_SOURCE_TYPE).trim().toLowerCase(),
      sourceReferencePath: absolutePath,
    };
  }

  private resolveReferencePath(rawPath: string) {
    const candidate = (rawPath || "").trim();
    if (!candidate) {
      throw new DocumentIngestionError(400, "INGEST_REFERENCE_REQUIRED", "filePath e obrigatorio para ingestao por referencia.");
    }

    const adminBase = resolveAbsolutePath(this.pathConfig.ragAdminBulkBasePath);
    const documentsBase = resolveAbsolutePath(this.pathConfig.documentsBasePath);
    const storageBase = resolveAbsolutePath(this.pathConfig.storageBasePath);
    const allowedBases = [adminBase, documentsBase, storageBase];

    const absoluteCandidate = path.isAbsolute(candidate)
      ? path.resolve(candidate)
      : path.resolve(adminBase, candidate);

    if (!allowedBases.some((base) => isWithinBase(base, absoluteCandidate))) {
      throw new DocumentIngestionError(
        403,
        "INGEST_REFERENCE_FORBIDDEN",
        "filePath fora das bases permitidas para ingestao em massa.",
      );
    }
    return absoluteCandidate;
  }

  private assertFileSize(sizeBytes: number) {
    if (sizeBytes > this.ingestionConfig.maxFileSizeBytes) {
      throw new DocumentIngestionError(
        413,
        "INGEST_FILE_TOO_LARGE",
        `Arquivo excede limite permitido (${this.ingestionConfig.maxFileSizeBytes} bytes).`,
      );
    }
  }

  private resolveActorSegment(actor: IngestionActor) {
    if (actor.userId) return `user-${sanitizePathSegment(actor.userId)}`;
    if (actor.sessionId) return `session-${sanitizePathSegment(actor.sessionId)}`;
    return "anonymous";
  }

  private normalizeTitle(title: string | undefined, fileName: string) {
    const trimmed = (title || "").trim();
    if (trimmed) return trimmed.slice(0, 200);
    return fileName.slice(0, 200);
  }

  private async persistRawFile(fileName: string, contentHash: string, bytes: Buffer, actorSegment: string) {
    const rawBasePath = resolveAbsolutePath(this.pathConfig.ragRawDocumentsPath);
    const targetDirectory = path.join(rawBasePath, actorSegment, contentHash.slice(0, 2));
    await mkdir(targetDirectory, { recursive: true });

    const targetFileName = `${nowStamp()}-${contentHash.slice(0, 12)}-${sanitizeFileName(fileName)}`;
    const absoluteTargetPath = path.join(targetDirectory, targetFileName);
    await writeFile(absoluteTargetPath, bytes);
    return absoluteTargetPath;
  }

  private async persistExtractedText(contentHash: string, text: string) {
    const textBasePath = resolveAbsolutePath(this.pathConfig.ragExtractedTextPath);
    const targetDirectory = path.join(textBasePath, contentHash.slice(0, 2));
    await mkdir(targetDirectory, { recursive: true });

    const absoluteTargetPath = path.join(targetDirectory, `${contentHash}.txt`);
    await writeFile(absoluteTargetPath, text, { encoding: "utf8" });
    return absoluteTargetPath;
  }

  private async createIngestionJob(): Promise<number | null> {
    try {
      const { rows } = await this.vectorDb.query<{ id: string | number }>(
        `
        insert into vector_store.ingestion_jobs (status, started_at, created_at)
        values ('running', now(), now())
        returning id
        `,
      );
      if (!rows.length) {
        throw new DocumentIngestionError(500, "INGEST_JOB_CREATE_FAILED", "Nao foi possivel criar ingestion job.");
      }
      return toInteger(rows[0].id, 0);
    } catch (error) {
      if (isUndefinedTableError(error, "vector_store.ingestion_jobs")) {
        logger.warn("RAG_INGEST_JOB_TABLE_MISSING", {
          table: "vector_store.ingestion_jobs",
          action: "ingestion_job_tracking_disabled",
        });
        return null;
      }
      throw error;
    }
  }

  private async finishIngestionJob(
    jobId: number | null,
    status: "succeeded" | "failed",
    documentId: number | null,
    errorMessage: string | null,
  ) {
    if (!jobId) return;
    await this.vectorDb.query(
      `
      update vector_store.ingestion_jobs
      set
        status = $2,
        document_id = $3,
        error_message = $4,
        finished_at = now()
      where id = $1
      `,
      [jobId, status, documentId, errorMessage],
    );
  }

  private async findDocumentByContentHash(contentHash: string): Promise<ExistingDocumentRow | null> {
    const { rows } = await this.vectorDb.query<ExistingDocumentRow>(
      `
      select
        id,
        status,
        source_type,
        source_path,
        title,
        coalesce(metadata->>'embedding_status', 'pending') as embedding_status,
        coalesce(metadata#>>'{ingestion,parser}', 'utf8') as parser
      from vector_store.documents
      where content_hash = $1
      limit 1
      `,
      [contentHash],
    );
    return rows[0] || null;
  }

  private async insertDocumentWithChunks(input: {
    sourceType: string;
    sourcePath: string;
    originalFilename: string;
    mimeType: string;
    contentHash: string;
    title: string;
    metadata: JsonObject;
    chunks: TextChunk[];
  }) {
    return this.vectorDb.withClient(async (client) => {
      await client.query("begin");
      try {
        const sourceId = await this.upsertDocumentSource(client, input.sourceType, input.sourcePath, input.originalFilename);
        const documentId = await this.insertDocument(client, {
          sourceId,
          sourceType: input.sourceType,
          sourcePath: input.sourcePath,
          originalFilename: input.originalFilename,
          mimeType: input.mimeType,
          contentHash: input.contentHash,
          title: input.title,
          metadata: input.metadata,
        });
        const chunkCount = await this.insertChunks(client, documentId, input.chunks);
        await this.markDocumentProcessed(client, documentId, chunkCount);
        await client.query("commit");
        return { documentId, chunkCount };
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    });
  }

  private async upsertDocumentSource(client: PoolClient, sourceType: string, sourcePath: string, displayName: string) {
    const metadata = { managed_by: "document_ingestion_service", updated_at: new Date().toISOString() };
    const { rows } = await client.query<{ id: string | number }>(
      `
      insert into vector_store.document_sources (source_type, source_path, display_name, metadata)
      values ($1, $2, $3, $4::jsonb)
      on conflict (source_type, source_path)
      do update set
        display_name = excluded.display_name,
        metadata = coalesce(vector_store.document_sources.metadata, '{}'::jsonb) || excluded.metadata
      returning id
      `,
      [sourceType, sourcePath, displayName, JSON.stringify(metadata)],
    );
    if (!rows.length) {
      throw new DocumentIngestionError(500, "INGEST_SOURCE_UPSERT_FAILED", "Falha ao registrar source do documento.");
    }
    return toInteger(rows[0].id);
  }

  private async insertDocument(
    client: PoolClient,
    input: {
      sourceId: number;
      sourceType: string;
      sourcePath: string;
      originalFilename: string;
      mimeType: string;
      contentHash: string;
      title: string;
      metadata: JsonObject;
    },
  ) {
    const { rows } = await client.query<{ id: string | number }>(
      `
      insert into vector_store.documents (
        source_id,
        source_type,
        source_path,
        original_filename,
        mime_type,
        content_hash,
        title,
        status,
        metadata
      )
      values ($1, $2, $3, $4, $5, $6, $7, 'processing', $8::jsonb)
      returning id
      `,
      [
        input.sourceId,
        input.sourceType,
        input.sourcePath,
        input.originalFilename,
        input.mimeType,
        input.contentHash,
        input.title,
        JSON.stringify(input.metadata),
      ],
    );
    if (!rows.length) {
      throw new DocumentIngestionError(500, "INGEST_DOCUMENT_INSERT_FAILED", "Falha ao criar documento no RAG.");
    }
    return toInteger(rows[0].id);
  }

  private async insertChunks(client: PoolClient, documentId: number, chunks: TextChunk[]) {
    const payload = chunks.map((chunk) => ({
      chunk_index: chunk.chunkIndex,
      text: chunk.text,
      token_count: chunk.tokenCount,
      char_start: chunk.charStart,
      char_end: chunk.charEnd,
    }));
    const result = await client.query(
      `
      insert into vector_store.document_chunks (
        document_id,
        chunk_index,
        text,
        token_count,
        char_start,
        char_end
      )
      select
        $1,
        c.chunk_index,
        c.text,
        c.token_count,
        c.char_start,
        c.char_end
      from jsonb_to_recordset($2::jsonb) as c(
        chunk_index int,
        text text,
        token_count int,
        char_start int,
        char_end int
      )
      `,
      [documentId, JSON.stringify(payload)],
    );
    return result.rowCount || 0;
  }

  private async markDocumentProcessed(client: PoolClient, documentId: number, chunkCount: number) {
    await client.query(
      `
      update vector_store.documents
      set
        status = 'processed',
        metadata = coalesce(metadata, '{}'::jsonb) ||
          jsonb_build_object(
            'embedding_status', 'pending',
            'chunk_count', $2::int,
            'processed_at', now()
          )
      where id = $1
      `,
      [documentId, chunkCount],
    );
  }
}

export function createDocumentIngestionService(rawEnv = process.env) {
  return new DocumentIngestionService(createVectorDatabaseClient(rawEnv), {
    pathConfig: loadPathConfig(rawEnv),
    ingestionConfig: loadRagIngestionConfig(rawEnv),
  });
}
