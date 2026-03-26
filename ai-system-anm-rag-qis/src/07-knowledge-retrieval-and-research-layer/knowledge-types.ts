export interface KnowledgeCandidate {
  title: string;
  url: string;
  snippet: string;
  freshnessScore: number;
  trustScore: number;
  relevanceScore: number;
  sourceType:
    | "memory"
    | "context"
    | "internal"
    | "web"
    | "existing"
    | "retriever"
    | "rag"
    | "vector"
    | "docs"
    | "connector";
}

export interface EvidenceBundle {
  snippets: string[];
  citations: string[];
  contradictionFlags: string[];
  confidence: number;
}
