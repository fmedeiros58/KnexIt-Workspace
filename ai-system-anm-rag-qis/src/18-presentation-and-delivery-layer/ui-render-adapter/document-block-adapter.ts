import { classifySourceKind, collapseWhitespace } from "../presentation-contracts";
import type { DocumentView } from "../presentation-contracts";
import type { RetrievedSource } from "../../bridges/contracts/processing-state";

export interface DocumentBlockAdapterInput {
  sources: RetrievedSource[];
  maxDocuments?: number;
}

export interface DocumentBlockAdapterOutput {
  ok: boolean;
  component: string;
  score: number;
  documents: DocumentView[];
}

export function documentBlockAdapter(input: DocumentBlockAdapterInput): DocumentBlockAdapterOutput {
  const maxDocuments = Number.isFinite(input.maxDocuments)
    ? Math.max(1, Math.trunc(input.maxDocuments as number))
    : 6;
  const documents: DocumentView[] = [];
  const seen = new Set<string>();

  for (const source of input.sources || []) {
    const sourcePath = `${source.url || ""}`.trim();
    if (!sourcePath || seen.has(sourcePath)) continue;
    seen.add(sourcePath);
    documents.push({
      title: collapseWhitespace(source.title || "documento"),
      source: sourcePath,
      snippet: collapseWhitespace(source.snippet || "").slice(0, 280),
      kind: classifySourceKind(sourcePath),
    });
    if (documents.length >= maxDocuments) break;
  }

  return {
    ok: true,
    component: "document-block-adapter",
    score: documents.length ? 0.88 : 0.46,
    documents,
  };
}
