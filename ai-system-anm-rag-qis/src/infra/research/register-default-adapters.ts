import { createVectorRetrievalRepository } from "../../../../core/database/vector-retrieval-repository";
import { QueryEmbeddingClient } from "../../../../core/rag/embedding-client";
import { registerLocalFactualDbAdapter } from "./local-factual-db-client";
import { registerLocalLibraryAdapter } from "./local-library-client";
import { registerLocalVectorDbAdapter } from "./local-vector-db-client";

function resolveUrl(sourcePath: string, documentId: number, chunkId: number): string {
  const trimmed = `${sourcePath || ""}`.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed) return `file://${trimmed.replace(/\\/g, "/")}`;
  return `document://vector_store/document/${documentId}/chunk/${chunkId}`;
}

let registered = false;

export function registerDefaultResearchAdapters(input: {
  factualDb?: { searchFacts: (query: string, limit: number) => Promise<any[]> };
  vectorDb?: { searchSemantic: (query: string, limit: number) => Promise<any[]> };
  library?: { searchDocuments: (query: string, limit: number) => Promise<any[]> };
}): void {
  if (input.factualDb) registerLocalFactualDbAdapter(input.factualDb);
  if (input.vectorDb) registerLocalVectorDbAdapter(input.vectorDb);
  if (input.library) registerLocalLibraryAdapter(input.library);
}

export function ensureDefaultResearchAdapters(): void {
  if (registered) return;
  registered = true;

  const vectorRepo = createVectorRetrievalRepository();
  const embeddingClient = new QueryEmbeddingClient();

  registerLocalFactualDbAdapter({
    async searchFacts(query: string, limit: number) {
      try {
        const rows = await vectorRepo.searchLexicalTopK({
          queryText: query,
          topK: Math.max(1, limit),
          sourceType: "official_registry",
        });
        return rows.map((row) => ({
          id: `${row.documentId}:${row.chunkId}`,
          title: row.title || `document-${row.documentId}`,
          snippet: row.text,
          updatedAt: undefined,
          url: resolveUrl(row.sourcePath, row.documentId, row.chunkId),
          metadata: row.metadata,
        }));
      } catch {
        return [];
      }
    },
  });

  registerLocalVectorDbAdapter({
    async searchSemantic(query: string, limit: number) {
      try {
        const embedding = await embeddingClient.embedQuery(query);
        const rows = await vectorRepo.searchTopK({
          queryVector: embedding.vector,
          topK: Math.max(1, limit),
          embeddingModel: embedding.model,
        });
        return rows.map((row) => ({
          id: `${row.documentId}:${row.chunkId}`,
          title: row.title || `document-${row.documentId}`,
          snippet: row.text,
          score: row.score,
          updatedAt: undefined,
          url: resolveUrl(row.sourcePath, row.documentId, row.chunkId),
          metadata: row.metadata,
        }));
      } catch {
        return [];
      }
    },
  });

  registerLocalLibraryAdapter({
    async searchDocuments(query: string, limit: number) {
      try {
        const rows = await vectorRepo.searchLexicalTopK({
          queryText: query,
          topK: Math.max(1, limit),
        });
        return rows.map((row) => ({
          id: `${row.documentId}:${row.chunkId}`,
          title: row.title || `document-${row.documentId}`,
          snippet: row.text,
          path: row.sourcePath,
          updatedAt: undefined,
          metadata: row.metadata,
        }));
      } catch {
        return [];
      }
    },
  });
}
