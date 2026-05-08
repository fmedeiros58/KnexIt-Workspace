export type ProjectKind =
  | "book"
  | "tcc"
  | "edital"
  | "report"
  | "article"
  | "lesson_plan"
  | "research_project"
  | "dissertation"
  | "thesis";

export type OrganizationTab =
  | "projects"
  | "sections"
  | "contexts"
  | "references"
  | "structure"
  | "notes"
  | "revisions"
  | "files"
  | "archived"
  | "trash"
  | "settings"
  | "more";

export type SourceFileType =
  | "pdf"
  | "docx"
  | "image"
  | "spreadsheet"
  | "link"
  | "book"
  | "article"
  | "thesis"
  | "dissertation"
  | "law"
  | "other";

export type MetadataStatus = "empty" | "partial" | "complete" | "needs_review";

export type BibliographicMetadata = {
  author?: string;
  year?: string;
  title?: string;
  subtitle?: string;
  publisher?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  isbn?: string;
  url?: string;
  accessDate?: string;
  place?: string;
  edition?: string;
};

export type SourceFile = {
  id: string;
  projectId: string;
  name: string;
  type: SourceFileType;
  fileHandleId?: string;
  directoryHandleId?: string;
  fileName?: string;
  fileUrl?: string;
  externalUrl?: string;
  sizeBytes?: number;
  mimeType?: string;
  lastModified?: number;
  rootFolderName?: string;
  status: "available" | "used" | "unused" | "missing" | "needs_review";
  createdAt: string;
  updatedAt: string;
  metadataStatus: MetadataStatus;
  bibliographicMetadata?: BibliographicMetadata;
};

export type ProjectReferenceType =
  | "book"
  | "article"
  | "thesis"
  | "dissertation"
  | "law"
  | "website"
  | "report"
  | "other";

export type ProjectReference = {
  id: string;
  projectId: string;
  sourceFileId?: string;
  author?: string;
  year?: string;
  title: string;
  type: ProjectReferenceType;
  metadataStatus: Exclude<MetadataStatus, "empty">;
  citationKey?: string;
  abntFormatted?: string;
  apaFormatted?: string;
  createdAt: string;
  updatedAt: string;
};

export type ReferenceUsageType =
  | "direct_quote"
  | "indirect_quote"
  | "paraphrase"
  | "note"
  | "ai_inserted_citation";

export type ReferenceUsage = {
  id: string;
  projectId: string;
  referenceId: string;
  sourceFileId?: string;
  sectionId?: string;
  contextId?: string;
  pageNumber?: number;
  paragraphId?: string;
  usageType: ReferenceUsageType;
  quoteText?: string;
  citationText?: string;
  sourcePage?: string;
  sourceLocator?: string;
  createdAt: string;
  updatedAt: string;
};

export type ReferenceAuditIssue = {
  id: string;
  projectId: string;
  referenceId?: string;
  sourceFileId?: string;
  severity: "info" | "warning" | "error";
  kind:
    | "used_source_missing_metadata"
    | "direct_quote_missing_page"
    | "citation_in_text_without_reference"
    | "reference_without_usage"
    | "source_file_never_used"
    | "metadata_needs_review";
  message: string;
};

export type ReferenceFilter =
  | "available_sources"
  | "all"
  | "used"
  | "unused"
  | "pending"
  | "direct_quotes"
  | "indirect_quotes"
  | "bibliography";

export type OrganizationProjectItem = {
  project_id: string;
  title: string;
  description?: string | null;
  objective?: string | null;
  updated_at?: string | null;
};

export type WriterProject = {
  id: string;
  kind: ProjectKind;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  rootFolderHandleId?: string;
  rootFolderName?: string;
};

export type SavedDocumentGuard = {
  id: string;
  projectId: string | null;
  title: string;
  fileName: string;
  format: "docx" | "pdf" | "knexwriter";
  projectKind: ProjectKind;
  citationStyle: "abnt" | "apa";
  createdAt: string;
  sourceFileCount: number;
  usedReferenceCount: number;
  auditIssueCount: number;
  guardIssues: Array<{
    severity: "info" | "warning" | "error";
    message: string;
  }>;
};

export type OrganizationSectionItem = {
  section_id: string;
  title: string;
  objective?: string | null;
  status?: string | null;
  order?: number | null;
  chunks?: unknown[] | null;
};

export type OrganizationContextItem = {
  id: string;
  label: string;
  summary?: string;
  severity?: string;
  occurrenceCount?: number;
};

export type OrganizationPreset = {
  projectKind: ProjectKind;
  visibleTabs: OrganizationTab[];
  defaultReferenceFilters: ReferenceFilter[];
  preferredSectionNames: string[];
  relevantReferenceTypes: ProjectReferenceType[];
  terminology: {
    sections: string;
    references: string;
    files: string;
  };
};

export type InsertCitationFromSourceInput = {
  sourceFileId: string;
  quoteText?: string;
  usageType: ReferenceUsageType;
  sourcePage?: string;
  sectionId?: string;
  contextId?: string;
  paragraphId?: string;
  citationText?: string;
};

export type LinkSelectedTextToReferenceInput = {
  referenceId: string;
  sourceFileId?: string;
  usageType: ReferenceUsageType;
  sourcePage?: string;
  sectionId?: string;
  contextId?: string;
  paragraphId?: string;
  citationText?: string;
};

export type OrganizationStoreSnapshot = {
  projectKind: ProjectKind;
  projectKindsById: Record<string, ProjectKind>;
  projectRootFoldersById: Record<string, { handleId: string; name: string; updatedAt: string }>;
  sourceFiles: SourceFile[];
  projectReferences: ProjectReference[];
  referenceUsages: ReferenceUsage[];
  savedDocumentGuards: SavedDocumentGuard[];
  activeOrganizationTab: OrganizationTab;
  activeReferenceFilter: ReferenceFilter;
  searchQuery: string;
};

export const PROJECT_KIND_LABEL: Record<ProjectKind, string> = {
  book: "Livro",
  tcc: "TCC",
  edital: "Edital",
  report: "Relatório",
  article: "Artigo",
  lesson_plan: "Plano de aula",
  research_project: "Projeto de pesquisa",
  dissertation: "Dissertação",
  thesis: "Tese",
};

export const ORGANIZATION_TAB_LABEL: Record<OrganizationTab, string> = {
  projects: "Projetos",
  sections: "Seções",
  contexts: "Contextos",
  references: "Referências",
  structure: "Estrutura",
  notes: "Notas",
  revisions: "Revisões",
  files: "Arquivos",
  archived: "Arquivados",
  trash: "Lixeira",
  settings: "Configurações",
  more: "Mais",
};

export const REFERENCE_FILTER_LABEL: Record<ReferenceFilter, string> = {
  available_sources: "Fontes disponíveis",
  all: "Todas",
  used: "Usadas",
  unused: "Não usadas",
  pending: "Pendentes",
  direct_quotes: "Citações diretas",
  indirect_quotes: "Citações indiretas",
  bibliography: "Bibliografia final",
};
