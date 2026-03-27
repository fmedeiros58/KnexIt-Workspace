import { classifySourceKind, collapseWhitespace } from "../presentation-contracts";
import type { CitationView } from "../presentation-contracts";
import type { RetrievedSource } from "../../bridges/contracts/processing-state";

export interface CitationAdapterInput {
  sources: RetrievedSource[];
  maxCitations?: number;
}

export interface CitationAdapterOutput {
  ok: boolean;
  component: string;
  score: number;
  citations: CitationView[];
}

export function citationAdapter(input: CitationAdapterInput): CitationAdapterOutput {
  const maxCitations = Number.isFinite(input.maxCitations)
    ? Math.max(1, Math.trunc(input.maxCitations as number))
    : 8;
  const deduped = new Map<string, CitationView>();

  for (const source of input.sources || []) {
    const url = `${source.url || ""}`.trim();
    if (!url || deduped.has(url)) continue;
    const kind = classifySourceKind(url);
    deduped.set(url, {
      url,
      title: collapseWhitespace(source.title || "fonte"),
      snippet: collapseWhitespace(source.snippet || ""),
      freshnessScore: Number.isFinite(source.freshnessScore) ? Number(source.freshnessScore) : 0,
      trustHint: kind === "web" ? "verified" : "unverified",
    });
    if (deduped.size >= maxCitations) break;
  }

  const citations = [...deduped.values()];
  const verifiedRatio = citations.length
    ? citations.filter((row) => row.trustHint === "verified").length / citations.length
    : 0;

  return {
    ok: true,
    component: "citation-adapter",
    score: Math.max(0.4, Math.min(0.96, 0.55 + verifiedRatio * 0.35)),
    citations,
  };
}
