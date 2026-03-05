import { readFile } from "fs/promises";
import path from "path";

import { createVectorDatabaseClient, type VectorDatabaseClient } from "../database/vector-client";
import { logger } from "../utils/logger";
import type { VectorTopKResult } from "../database/vector-retrieval-repository";

type JsonObject = Record<string, unknown>;

type DocumentRow = {
  id: string | number;
  title: string | null;
  source_path: string;
  metadata: JsonObject | null;
};

type ChunkRow = {
  text: string;
};

type FullDocSource = {
  documentId: number;
  title: string | null;
  sourcePath: string;
  readSource: "extracted_text_file" | "document_chunks";
  fullChars: number;
  includedChars: number;
  truncated: boolean;
};

export type FullDocumentContextAudit = {
  enabled: boolean;
  attemptedDocs: number;
  loadedDocs: number;
  contextDocs: number;
  failedDocs: number;
  fullReadChars: number;
  includedChars: number;
  truncatedDocs: number;
  sources: FullDocSource[];
};

export type FullDocumentContextResult = {
  text: string;
  audit: FullDocumentContextAudit;
};

type FullDocumentConfig = {
  enabled: boolean;
  maxDocs: number;
  maxContextChars: number;
};

const DEFAULT_FULL_DOCUMENT_READ_ENABLED = true;
const DEFAULT_FULL_DOCUMENT_MAX_DOCS = 2;
const DEFAULT_FULL_DOCUMENT_MAX_CONTEXT_CHARS = 24_000;

function toInteger(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function normalizeMetadata(value: JsonObject | null | undefined): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

function parsePositiveInt(value: string | undefined, fallback: number, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function resolveConfig(raw: NodeJS.ProcessEnv = process.env): FullDocumentConfig {
  return {
    enabled: parseBoolean(raw.RAG_FULL_DOCUMENT_READ_ENABLED, DEFAULT_FULL_DOCUMENT_READ_ENABLED),
    maxDocs: parsePositiveInt(raw.RAG_FULL_DOCUMENT_MAX_DOCS, DEFAULT_FULL_DOCUMENT_MAX_DOCS, 1, 10),
    maxContextChars: parsePositiveInt(
      raw.RAG_FULL_DOCUMENT_MAX_CONTEXT_CHARS,
      DEFAULT_FULL_DOCUMENT_MAX_CONTEXT_CHARS,
      1_000,
      200_000,
    ),
  };
}

function uniqDocumentIdsFromHits(hits: VectorTopKResult[]) {
  const seen = new Set<number>();
  const ordered: number[] = [];
  for (const hit of hits) {
    const id = toInteger(hit.documentId, 0);
    if (id <= 0 || seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }
  return ordered;
}

function extractExtractedTextPath(metadata: JsonObject) {
  const ingestion = metadata.ingestion;
  if (!ingestion || typeof ingestion !== "object" || Array.isArray(ingestion)) return "";
  const raw = (ingestion as { extracted_text_path?: unknown }).extracted_text_path;
  return typeof raw === "string" ? raw.trim() : "";
}

function normalizeForContext(title: string | null, text: string) {
  const body = `${text || ""}`.trim();
  if (!body) return "";
  const safeTitle = `${title || "documento"}`.trim() || "documento";
  return [`[DOCUMENTO INTEGRAL: ${safeTitle}]`, body].join("\n");
}

function resolveWithinWorkspace(candidate: string) {
  if (!candidate) return "";
  const absolute = path.isAbsolute(candidate) ? path.resolve(candidate) : path.resolve(process.cwd(), candidate);
  const relative = path.relative(process.cwd(), absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return "";
  return absolute;
}

export class DocumentFullTextService {
  private readonly config: FullDocumentConfig;

  constructor(
    private readonly vectorDb: VectorDatabaseClient = createVectorDatabaseClient(),
    rawEnv: NodeJS.ProcessEnv = process.env,
  ) {
    this.config = resolveConfig(rawEnv);
  }

  async buildContextFromHits(hits: VectorTopKResult[]): Promise<FullDocumentContextResult> {
    const targetDocIds = uniqDocumentIdsFromHits(hits).slice(0, this.config.maxDocs);
    return this.buildContextFromDocumentIds(targetDocIds);
  }

  async buildContextFromDocumentIds(documentIds: number[]): Promise<FullDocumentContextResult> {
    const normalizedDocIds = Array.from(
      new Set(
        (Array.isArray(documentIds) ? documentIds : [])
          .map((value) => toInteger(value, 0))
          .filter((value) => value > 0),
      ),
    ).slice(0, this.config.maxDocs);

    const audit: FullDocumentContextAudit = {
      enabled: this.config.enabled,
      attemptedDocs: 0,
      loadedDocs: 0,
      contextDocs: 0,
      failedDocs: 0,
      fullReadChars: 0,
      includedChars: 0,
      truncatedDocs: 0,
      sources: [],
    };
    if (!this.config.enabled) {
      return { text: "", audit };
    }

    audit.attemptedDocs = normalizedDocIds.length;
    if (!normalizedDocIds.length) return { text: "", audit };

    const contextBlocks: string[] = [];
    let remainingChars = this.config.maxContextChars;

    for (const documentId of normalizedDocIds) {
      const loaded = await this.loadFullDocument(documentId).catch((error) => {
        logger.warn("RAG_FULLDOC_LOAD_FAILED", {
          documentId,
          message: error instanceof Error ? error.message : "unknown_error",
        });
        return null;
      });

      if (!loaded) {
        audit.failedDocs += 1;
        continue;
      }
      audit.loadedDocs += 1;
      audit.fullReadChars += loaded.fullChars;

      const block = normalizeForContext(loaded.title, loaded.text);
      if (!block) continue;

      const blockLen = block.length;
      const includeLen = Math.max(0, Math.min(blockLen, remainingChars));
      if (includeLen <= 0) {
        audit.sources.push({
          documentId: loaded.documentId,
          title: loaded.title,
          sourcePath: loaded.sourcePath,
          readSource: loaded.readSource,
          fullChars: loaded.fullChars,
          includedChars: 0,
          truncated: true,
        });
        audit.truncatedDocs += 1;
        continue;
      }

      const includedBlock = includeLen === blockLen ? block : block.slice(0, includeLen).trimEnd();
      contextBlocks.push(includedBlock);
      remainingChars = Math.max(0, remainingChars - includeLen);
      audit.includedChars += includeLen;
      audit.contextDocs += 1;

      const truncated = includeLen < blockLen;
      if (truncated) audit.truncatedDocs += 1;
      audit.sources.push({
        documentId: loaded.documentId,
        title: loaded.title,
        sourcePath: loaded.sourcePath,
        readSource: loaded.readSource,
        fullChars: loaded.fullChars,
        includedChars: includeLen,
        truncated,
      });
    }

    return {
      text: contextBlocks.join("\n\n"),
      audit,
    };
  }

  private async loadFullDocument(documentId: number): Promise<{
    documentId: number;
    title: string | null;
    sourcePath: string;
    readSource: "extracted_text_file" | "document_chunks";
    text: string;
    fullChars: number;
  } | null> {
    const docQuery = await this.vectorDb.query<DocumentRow>(
      `
      select id, title, source_path, metadata
      from vector_store.documents
      where id = $1
      limit 1
      `,
      [documentId],
    );
    if (!docQuery.rows.length) return null;
    const row = docQuery.rows[0];
    const metadata = normalizeMetadata(row.metadata);
    const extractedPath = extractExtractedTextPath(metadata);

    if (extractedPath) {
      const resolved = resolveWithinWorkspace(extractedPath);
      if (resolved) {
        try {
          const text = await readFile(resolved, { encoding: "utf8" });
          const normalized = `${text || ""}`.trim();
          if (normalized) {
            return {
              documentId: toInteger(row.id),
              title: row.title,
              sourcePath: row.source_path,
              readSource: "extracted_text_file",
              text: normalized,
              fullChars: normalized.length,
            };
          }
        } catch {
          logger.warn("RAG_FULLDOC_EXTRACTED_TEXT_READ_FAILED", { documentId, extractedPath });
        }
      }
    }

    const chunksQuery = await this.vectorDb.query<ChunkRow>(
      `
      select text
      from vector_store.document_chunks
      where document_id = $1
      order by chunk_index asc
      `,
      [documentId],
    );
    const rebuilt = chunksQuery.rows.map((chunk) => `${chunk.text || ""}`.trim()).filter(Boolean).join("\n");
    const normalized = rebuilt.trim();
    if (!normalized) return null;

    return {
      documentId: toInteger(row.id),
      title: row.title,
      sourcePath: row.source_path,
      readSource: "document_chunks",
      text: normalized,
      fullChars: normalized.length,
    };
  }
}

export function createDocumentFullTextService(rawEnv = process.env) {
  return new DocumentFullTextService(createVectorDatabaseClient(rawEnv), rawEnv);
}
