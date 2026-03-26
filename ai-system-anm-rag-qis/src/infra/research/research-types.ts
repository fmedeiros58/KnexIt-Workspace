export type ResearchSourceType =
  | "web"
  | "wikipedia"
  | "pubmed"
  | "crossref"
  | "openalex"
  | "arxiv"
  | "local_factual_db"
  | "local_vector_db"
  | "local_library";

export type ResearchFailureKind =
  | "timeout"
  | "network_error"
  | "http_error"
  | "parse_error"
  | "empty_result"
  | "unsupported"
  | "unknown_error";

export type ResearchIntent =
  | "general"
  | "factual"
  | "scientific"
  | "bibliographic"
  | "current_events"
  | "biomedical"
  | "academic"
  | "local_only";

export interface ResearchDocument {
  id?: string;
  title: string;
  url?: string;
  snippet: string;
  sourceType: ResearchSourceType;
  provider: string;
  publishedAt?: string;
  updatedAt?: string;
  doi?: string;
  pmid?: string;
  arxivId?: string;
  authors?: string[];
  journal?: string;
  trustScore?: number;
  freshnessScore?: number;
  relevanceScore?: number;
  citationCount?: number;
  localDocumentId?: string;
  metadata?: Record<string, unknown>;
}

export interface ResearchDiagnostics {
  provider: string;
  sourceType: ResearchSourceType;
  ok: boolean;
  durationMs?: number;
  statusCode?: number;
  resultCount: number;
  failureKind?: ResearchFailureKind;
  message?: string;
}

export interface FederatedResearchResponse {
  results: ResearchDocument[];
  diagnostics: ResearchDiagnostics[];
}

export interface FederatedResearchOptions {
  maxResults?: number;
  includeLocal?: boolean;
  includeRemote?: boolean;
  allowedSources?: ResearchSourceType[];
  forceScientific?: boolean;
  forceCurrent?: boolean;
}

export interface ResearchProvider {
  name: string;
  sourceType: ResearchSourceType;
  search: (query: string, options?: FederatedResearchOptions) => Promise<FederatedResearchResponse>;
}
