import { createHash } from "crypto";
import { pathToFileURL } from "url";
import path from "path";

import { createVectorDatabaseClient, type VectorDatabaseClient } from "@/core/database/vector-client";
import { ChunkerV2, type PageTextV2 } from "@/core/rag/v2/index/chunker_v2";
import { EmbeddingsIndexerV2 } from "@/core/rag/v2/index/embeddings_v2";

type PdfJsModule = {
  getDocument: (params: Record<string, unknown>) => {
    promise: Promise<{
      numPages: number;
      getPage: (pageNumber: number) => Promise<{
        getTextContent: () => Promise<{ items: unknown[] }>;
        cleanup: () => void;
      }>;
      destroy: () => Promise<void>;
    }>;
  };
};

let cachedPdfJsModule: PdfJsModule | null = null;

async function loadPdfJsModule() {
  if (cachedPdfJsModule) return cachedPdfJsModule;
  const modulePath = path.resolve(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.mjs");
  const moduleUrl = pathToFileURL(modulePath).toString();
  cachedPdfJsModule = (await import(/* webpackIgnore: true */ moduleUrl)) as PdfJsModule;
  return cachedPdfJsModule;
}

function normalizeText(value: string) {
  return `${value || ""}`
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function textHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function extractPdfPages(bytes: Buffer, minTextPerPage: number): Promise<PageTextV2[]> {
  const pdfjs = await loadPdfJsModule();
  const loading = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableWorker: true,
    useSystemFonts: false,
    verbosity: 0,
  });
  const doc = await loading.promise;
  try {
    const pages: PageTextV2[] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const textRaw = textContent.items
        .map((item: unknown) => {
          if (!item || typeof item !== "object") return "";
          const candidate = item as { str?: unknown };
          return typeof candidate.str === "string" ? candidate.str : "";
        })
        .filter(Boolean)
        .join(" ");
      const textNorm = normalizeText(textRaw);
      const needsOcr = textNorm.length < minTextPerPage;
      pages.push({
        pageNumber,
        textRaw,
        textNorm,
        hasOcr: false,
        headingHint: needsOcr ? "OCR pendente" : null,
      });
      page.cleanup();
    }
    return pages;
  } finally {
    await doc.destroy();
  }
}

export type IngestPdfV2Input = {
  userId: string | null;
  projectId: string | null;
  filename: string;
  mime: string;
  bytes: Buffer;
  pipelineVersion?: "v2";
  embeddingVersion?: string;
  chunkSizeChars?: number;
  overlapChars?: number;
  minTextPerPage?: number;
};

export type IngestPdfV2Result = {
  docId: number;
  pageCount: number;
  chunkCount: number;
  contentHash: string;
  embedding: {
    indexed: number;
    skipped: number;
    embeddingModel: string;
  };
};

export class DocumentIngestV2 {
  private readonly chunker = new ChunkerV2();
  private readonly embeddings = new EmbeddingsIndexerV2();

  constructor(private readonly vectorDb: VectorDatabaseClient = createVectorDatabaseClient()) {}

  async ingestPdf(input: IngestPdfV2Input): Promise<IngestPdfV2Result> {
    const pages = await extractPdfPages(input.bytes, Math.max(16, Math.trunc(input.minTextPerPage || 64)));
    const fullText = normalizeText(pages.map((row) => row.textNorm).join("\n\n"));
    const contentHash = textHash(fullText || input.bytes.toString("base64").slice(0, 1024));
    const pipelineVersion = input.pipelineVersion || "v2";
    const chunkRows = this.chunker.chunk({
      pages,
      chunkSizeChars: Math.max(600, Math.trunc(input.chunkSizeChars || 1400)),
      overlapChars: Math.max(0, Math.trunc(input.overlapChars || 180)),
      fallbackSectionPath: "Documento",
    });

    const docId = await this.vectorDb.withClient(async (client) => {
      await client.query("begin");
      try {
        const docInsert = await client.query<{ id: string | number }>(
          `
          insert into rag_v2.documents (
            user_id, project_id, filename, mime, sha256, parse_meta, created_at
          )
          values ($1, $2, $3, $4, $5, $6::jsonb, now())
          on conflict (sha256)
          do update set
            filename = excluded.filename,
            mime = excluded.mime,
            parse_meta = excluded.parse_meta
          returning id
          `,
          [
            input.userId,
            input.projectId,
            input.filename,
            input.mime,
            contentHash,
            JSON.stringify({
              pipeline_version: pipelineVersion,
              page_count: pages.length,
              ocr_auto_enabled: false,
              parser: "pdfjs",
            }),
          ],
        );
        const docIdValue = Number(docInsert.rows[0]?.id || 0);
        await client.query("delete from rag_v2.document_pages where doc_id = $1", [docIdValue]);
        for (const page of pages) {
          await client.query(
            `
            insert into rag_v2.document_pages (
              doc_id, page_number, text_raw, text_norm, has_ocr, parse_meta
            )
            values ($1, $2, $3, $4, $5, $6::jsonb)
            `,
            [
              docIdValue,
              page.pageNumber,
              page.textRaw,
              page.textNorm,
              page.hasOcr,
              JSON.stringify({
                pipeline_version: pipelineVersion,
                needs_ocr: page.textNorm.length < 64,
              }),
            ],
          );
        }
        await client.query(
          "delete from rag_v2.chunks where doc_id = $1 and pipeline_version = $2",
          [docIdValue, pipelineVersion],
        );
        for (const chunk of chunkRows) {
          await client.query(
            `
            insert into rag_v2.chunks (
              doc_id, chunk_index, page_start, page_end, section_path, text, text_norm, hash, offsets, pipeline_version, created_at
            )
            values (
              $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, now()
            )
            `,
            [
              docIdValue,
              chunk.chunkIndex,
              chunk.pageStart,
              chunk.pageEnd,
              chunk.sectionPath,
              chunk.text,
              chunk.text,
              chunk.hash,
              JSON.stringify(chunk.offsets),
              pipelineVersion,
            ],
          );
        }
        await client.query("commit");
        return docIdValue;
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    });

    const embeddingResult = await this.embeddings.index({
      docId,
      chunks: chunkRows,
      embeddingVersion: input.embeddingVersion || "v2-default",
    });

    return {
      docId,
      pageCount: pages.length,
      chunkCount: chunkRows.length,
      contentHash,
      embedding: embeddingResult,
    };
  }
}
