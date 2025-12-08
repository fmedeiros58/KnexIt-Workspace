export type ReviewQuestion = {
  model: "PICO" | "PICOS" | "PICo" | "Custom";
  population?: string;
  interventionOrExposure?: string;
  comparator?: string;
  outcomes?: string;
  context?: string;
  studyDesign?: string;
  customPrompt?: string;
};

export type BooleanOperator = "AND" | "OR" | "NOT";

export type BooleanTerm = {
  term: string;
  field?: string; // ex: title, abstract, fulltext
  truncation?: boolean;
  proximity?: { operator: "NEAR" | "ADJ"; distance: number };
};

export type BooleanTermGroup = {
  id: string;
  terms: BooleanTerm[];
  joinWith: BooleanOperator; // como os termos do grupo se relacionam (normalmente OR)
};

export type GenericSearchStrategy = {
  id: string;
  title: string;
  description?: string;
  groups: BooleanTermGroup[];
  betweenGroupsOperator: BooleanOperator; // como os grupos se combinam (normalmente AND)
  dateRange?: { from?: string; to?: string };
  languages?: string[];
  filters?: Record<string, any>;
};

export type SourceId = "pubmed" | "crossref" | "scielo" | "arxiv" | "doaj";

export type SearchResultRecord = {
  id: string;
  title: string;
  abstract?: string;
  authors?: string[];
  year?: number;
  doi?: string;
  source: SourceId;
  url?: string;
  pdfUrl?: string;
  documentId?: string; // para abrir no VioRead/SupaDrive
  publicationType?: string;
  language?: string;
};

export type ScreeningDecision = "include" | "exclude" | "maybe";

export type ScreeningRecord = {
  recordId: string;
  decision: ScreeningDecision;
  reason?: string;
  reviewer?: string;
  decidedAt?: string;
};

export type ExtractionField = {
  key: string;
  label: string;
  value: string;
};

export type ExtractionRecord = {
  recordId: string;
  fields: ExtractionField[];
  reviewer?: string;
  updatedAt?: string;
};

export type PrismaCounts = {
  identified: number;
  afterDedup: number;
  afterScreening: number;
  included: number;
};

