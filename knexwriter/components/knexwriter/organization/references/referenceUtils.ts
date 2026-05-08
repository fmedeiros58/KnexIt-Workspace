import type {
  MetadataStatus,
  ProjectReference,
  ProjectReferenceType,
  ReferenceAuditIssue,
  ReferenceUsage,
  ReferenceUsageType,
  SourceFile,
  SourceFileType,
} from "../organizationTypes";

const REFERENCE_TYPE_BY_SOURCE_TYPE: Record<SourceFileType, ProjectReferenceType> = {
  pdf: "other",
  docx: "other",
  image: "other",
  spreadsheet: "other",
  link: "website",
  book: "book",
  article: "article",
  thesis: "thesis",
  dissertation: "dissertation",
  law: "law",
  other: "other",
};

function nowIso(now?: string) {
  return now ?? new Date().toISOString();
}

function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getReferenceMetadataStatus(sourceFile: SourceFile): ProjectReference["metadataStatus"] {
  if (sourceFile.metadataStatus === "needs_review") return "needs_review";

  const metadata = sourceFile.bibliographicMetadata;
  if (!metadata) return "needs_review";

  const hasCoreMetadata = Boolean(metadata.title && metadata.author && metadata.year);
  if (!hasCoreMetadata) return "partial";

  const hasPublicationData = Boolean(
    metadata.publisher || metadata.journal || metadata.doi || metadata.isbn || metadata.url,
  );

  return hasPublicationData ? "complete" : "partial";
}

function normalizeTitleFromFileName(name: string) {
  return name
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createReferenceFromSourceFile(sourceFile: SourceFile, now?: string): ProjectReference {
  const metadata = sourceFile.bibliographicMetadata;
  const createdAt = nowIso(now);
  const title = metadata?.title?.trim() || normalizeTitleFromFileName(sourceFile.name) || sourceFile.name;
  const reference: ProjectReference = {
    id: `reference-${sourceFile.id}`,
    projectId: sourceFile.projectId,
    sourceFileId: sourceFile.id,
    author: metadata?.author,
    year: metadata?.year,
    title,
    type: REFERENCE_TYPE_BY_SOURCE_TYPE[sourceFile.type] ?? "other",
    metadataStatus: getReferenceMetadataStatus(sourceFile),
    citationKey: buildCitationKey(metadata?.author, metadata?.year, title),
    createdAt,
    updatedAt: createdAt,
  };

  return {
    ...reference,
    abntFormatted: formatReference(reference, "abnt"),
    apaFormatted: formatReference(reference, "apa"),
  };
}

export function ensureReferenceForSourceFile(args: {
  projectId: string;
  sourceFileId: string;
  sourceFiles: SourceFile[];
  references: ProjectReference[];
  now?: string;
}): { reference: ProjectReference; references: ProjectReference[]; created: boolean } {
  const existingReference = args.references.find(
    (reference) => reference.projectId === args.projectId && reference.sourceFileId === args.sourceFileId,
  );

  if (existingReference) {
    return { reference: existingReference, references: args.references, created: false };
  }

  const sourceFile = args.sourceFiles.find(
    (candidate) => candidate.projectId === args.projectId && candidate.id === args.sourceFileId,
  );

  if (!sourceFile) {
    throw new Error("Arquivo de origem não encontrado para criar referência.");
  }

  const reference = createReferenceFromSourceFile(sourceFile, args.now);
  return { reference, references: [...args.references, reference], created: true };
}

export function createReferenceUsage(input: {
  projectId: string;
  referenceId: string;
  sourceFileId?: string;
  usageType: ReferenceUsageType;
  quoteText?: string;
  citationText?: string;
  sourcePage?: string;
  sourceLocator?: string;
  pageNumber?: number;
  sectionId?: string;
  contextId?: string;
  paragraphId?: string;
  now?: string;
}): ReferenceUsage {
  const createdAt = nowIso(input.now);

  return {
    id: createLocalId("usage"),
    projectId: input.projectId,
    referenceId: input.referenceId,
    sourceFileId: input.sourceFileId,
    sectionId: input.sectionId,
    contextId: input.contextId,
    pageNumber: input.pageNumber,
    paragraphId: input.paragraphId,
    usageType: input.usageType,
    quoteText: input.quoteText,
    citationText: input.citationText,
    sourcePage: input.sourcePage,
    sourceLocator: input.sourceLocator,
    createdAt,
    updatedAt: createdAt,
  };
}

export function getUsedReferences(references: ProjectReference[], usages: ReferenceUsage[]) {
  const usedReferenceIds = new Set(usages.map((usage) => usage.referenceId));
  return references.filter((reference) => usedReferenceIds.has(reference.id));
}

export function getUnusedSourceFiles(sourceFiles: SourceFile[], usages: ReferenceUsage[]) {
  const usedSourceFileIds = new Set(
    usages.map((usage) => usage.sourceFileId).filter((sourceFileId): sourceFileId is string => Boolean(sourceFileId)),
  );

  return sourceFiles.filter((sourceFile) => !usedSourceFileIds.has(sourceFile.id));
}

export function getReferenceUsageCount(referenceId: string, usages: ReferenceUsage[]) {
  return usages.filter((usage) => usage.referenceId === referenceId).length;
}

export function getReferenceUsagesByReference(referenceId: string, usages: ReferenceUsage[]) {
  return usages.filter((usage) => usage.referenceId === referenceId);
}

export function buildReferenceAuditIssues(
  sourceFiles: SourceFile[],
  references: ProjectReference[],
  usages: ReferenceUsage[],
): ReferenceAuditIssue[] {
  const issues: ReferenceAuditIssue[] = [];
  const sourceById = new Map(sourceFiles.map((sourceFile) => [sourceFile.id, sourceFile]));

  sourceFiles.forEach((sourceFile) => {
    const isUsed = usages.some((usage) => usage.sourceFileId === sourceFile.id);

    if (!isUsed) {
      issues.push({
        id: `issue-unused-source-${sourceFile.id}`,
        projectId: sourceFile.projectId,
        sourceFileId: sourceFile.id,
        severity: "info",
        kind: "source_file_never_used",
        message: `Arquivo disponível ainda não usado no texto: ${sourceFile.name}.`,
      });
    }

    if (isUsed && sourceFile.metadataStatus !== "complete") {
      issues.push({
        id: `issue-used-source-metadata-${sourceFile.id}`,
        projectId: sourceFile.projectId,
        sourceFileId: sourceFile.id,
        severity: "warning",
        kind: "used_source_missing_metadata",
        message: `Arquivo usado com metadados incompletos: ${sourceFile.name}.`,
      });
    }
  });

  references.forEach((reference) => {
    const referenceUsages = getReferenceUsagesByReference(reference.id, usages);

    if (!referenceUsages.length) {
      issues.push({
        id: `issue-reference-unused-${reference.id}`,
        projectId: reference.projectId,
        referenceId: reference.id,
        sourceFileId: reference.sourceFileId,
        severity: "info",
        kind: "reference_without_usage",
        message: `Referência cadastrada sem uso no texto: ${reference.title}.`,
      });
    }

    if (reference.metadataStatus !== "complete") {
      issues.push({
        id: `issue-reference-metadata-${reference.id}`,
        projectId: reference.projectId,
        referenceId: reference.id,
        sourceFileId: reference.sourceFileId,
        severity: "warning",
        kind: "metadata_needs_review",
        message: `Metadados da referência precisam de revisão: ${reference.title}.`,
      });
    }
  });

  usages.forEach((usage) => {
    if (usage.usageType === "direct_quote" && !usage.sourcePage && !usage.sourceLocator) {
      issues.push({
        id: `issue-direct-quote-page-${usage.id}`,
        projectId: usage.projectId,
        referenceId: usage.referenceId,
        sourceFileId: usage.sourceFileId,
        severity: "error",
        kind: "direct_quote_missing_page",
        message: "Citação direta sem página ou localizador da fonte.",
      });
    }

    if (usage.sourceFileId && !sourceById.has(usage.sourceFileId)) {
      issues.push({
        id: `issue-citation-without-source-${usage.id}`,
        projectId: usage.projectId,
        referenceId: usage.referenceId,
        sourceFileId: usage.sourceFileId,
        severity: "error",
        kind: "citation_in_text_without_reference",
        message: "Uso de referência aponta para um arquivo não encontrado no projeto.",
      });
    }
  });

  return issues;
}

export function formatReference(reference: ProjectReference, style: "abnt" | "apa" | "vancouver" = "abnt") {
  if (style === "apa") {
    const author = reference.author || "Autor não informado";
    const year = reference.year ? `(${reference.year})` : "(s.d.)";
    return `${author}. ${year}. ${reference.title}.`;
  }

  if (style === "vancouver") {
    const author = reference.author || "Autor não informado";
    const year = reference.year ? ` ${reference.year}.` : "";
    return `${author}. ${reference.title}.${year}`.trim();
  }

  const author = reference.author ? reference.author.toUpperCase() : "AUTOR NÃO INFORMADO";
  const title = reference.title ? `${reference.title}.` : "Título não informado.";
  const year = reference.year ? ` ${reference.year}.` : " s.d.";
  return `${author}. ${title}${year}`;
}

function buildCitationKey(author: string | undefined, year: string | undefined, title: string) {
  const authorToken = (author || "fonte")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 16)
    .toLowerCase();
  const titleToken = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 16)
    .toLowerCase();

  return [authorToken, year, titleToken].filter(Boolean).join("-");
}
