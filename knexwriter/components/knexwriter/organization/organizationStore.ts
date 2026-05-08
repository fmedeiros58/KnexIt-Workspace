"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  InsertCitationFromSourceInput,
  LinkSelectedTextToReferenceInput,
  OrganizationPreset,
  OrganizationStoreSnapshot,
  OrganizationTab,
  ProjectKind,
  ProjectReference,
  ReferenceFilter,
  ReferenceUsage,
  SavedDocumentGuard,
  SourceFile,
  SourceFileType,
} from "./organizationTypes";
import {
  createReferenceUsage,
  ensureReferenceForSourceFile,
} from "./references/referenceUtils";

const ORGANIZATION_STORAGE_KEY = "knexwriter.organization.v1";

const DEFAULT_SNAPSHOT: OrganizationStoreSnapshot = {
  projectKind: "book",
  projectKindsById: {},
  projectRootFoldersById: {},
  sourceFiles: [],
  projectReferences: [],
  referenceUsages: [],
  savedDocumentGuards: [],
  activeOrganizationTab: "projects",
  activeReferenceFilter: "available_sources",
  searchQuery: "",
};

export function getOrganizationPresetByProjectKind(projectKind: ProjectKind): OrganizationPreset {
  const academicTabs: OrganizationTab[] = ["projects", "sections", "contexts", "references", "structure", "more"];

  const presets: Record<ProjectKind, OrganizationPreset> = {
    book: {
      projectKind,
      visibleTabs: academicTabs,
      defaultReferenceFilters: ["used", "pending", "bibliography"],
      preferredSectionNames: ["Capítulos", "Partes", "Cenas", "Anexos"],
      relevantReferenceTypes: ["book", "article", "report", "other"],
      terminology: { sections: "Capítulos", references: "Referências", files: "Fontes" },
    },
    tcc: {
      projectKind,
      visibleTabs: academicTabs,
      defaultReferenceFilters: ["pending", "used", "direct_quotes", "bibliography"],
      preferredSectionNames: ["Introdução", "Referencial teórico", "Metodologia", "Resultados", "Conclusão"],
      relevantReferenceTypes: ["book", "article", "thesis", "dissertation", "website"],
      terminology: { sections: "Seções acadêmicas", references: "Referências acadêmicas", files: "Fontes" },
    },
    edital: {
      projectKind,
      visibleTabs: ["projects", "sections", "references", "structure", "revisions", "more"],
      defaultReferenceFilters: ["used", "pending", "bibliography"],
      preferredSectionNames: ["Itens", "Subitens", "Anexos", "Cronograma", "Habilitação"],
      relevantReferenceTypes: ["law", "report", "website", "other"],
      terminology: { sections: "Itens", references: "Referências normativas", files: "Anexos e fontes" },
    },
    report: {
      projectKind,
      visibleTabs: academicTabs,
      defaultReferenceFilters: ["used", "pending", "bibliography"],
      preferredSectionNames: ["Resumo", "Diagnóstico", "Evidências", "Recomendações", "Anexos"],
      relevantReferenceTypes: ["report", "article", "website", "other"],
      terminology: { sections: "Blocos", references: "Fontes citadas", files: "Arquivos" },
    },
    article: {
      projectKind,
      visibleTabs: academicTabs,
      defaultReferenceFilters: ["pending", "used", "bibliography"],
      preferredSectionNames: ["Resumo", "Introdução", "Método", "Resultados", "Discussão"],
      relevantReferenceTypes: ["article", "book", "thesis", "dissertation", "website"],
      terminology: { sections: "Seções do artigo", references: "Referências", files: "Fontes" },
    },
    lesson_plan: {
      projectKind,
      visibleTabs: ["projects", "sections", "contexts", "references", "structure", "more"],
      defaultReferenceFilters: ["used", "pending", "bibliography"],
      preferredSectionNames: ["Objetivos", "Conteúdos", "Metodologia", "Avaliação", "Recursos"],
      relevantReferenceTypes: ["book", "article", "website", "other"],
      terminology: { sections: "Etapas", references: "Referências pedagógicas", files: "Recursos" },
    },
    research_project: {
      projectKind,
      visibleTabs: academicTabs,
      defaultReferenceFilters: ["pending", "used", "bibliography"],
      preferredSectionNames: ["Problema", "Justificativa", "Objetivos", "Metodologia", "Cronograma"],
      relevantReferenceTypes: ["book", "article", "thesis", "dissertation", "report"],
      terminology: { sections: "Seções do projeto", references: "Referências", files: "Fontes" },
    },
    dissertation: {
      projectKind,
      visibleTabs: academicTabs,
      defaultReferenceFilters: ["pending", "used", "direct_quotes", "bibliography"],
      preferredSectionNames: ["Capítulos", "Referencial teórico", "Metodologia", "Resultados", "Conclusão"],
      relevantReferenceTypes: ["book", "article", "thesis", "dissertation", "website"],
      terminology: { sections: "Capítulos", references: "Referências acadêmicas", files: "Fontes" },
    },
    thesis: {
      projectKind,
      visibleTabs: academicTabs,
      defaultReferenceFilters: ["pending", "used", "direct_quotes", "indirect_quotes", "bibliography"],
      preferredSectionNames: ["Capítulos", "Hipóteses", "Referencial teórico", "Metodologia", "Resultados"],
      relevantReferenceTypes: ["book", "article", "thesis", "dissertation", "report"],
      terminology: { sections: "Capítulos", references: "Referências acadêmicas", files: "Fontes" },
    },
  };

  return presets[projectKind];
}

export type AddSourceFileInput = {
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
  status?: SourceFile["status"];
  metadataStatus?: SourceFile["metadataStatus"];
  bibliographicMetadata?: SourceFile["bibliographicMetadata"];
};

export function useOrganizationStore() {
  const [snapshot, setSnapshot] = useState<OrganizationStoreSnapshot>(DEFAULT_SNAPSHOT);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(ORGANIZATION_STORAGE_KEY);
      if (!stored) return;

      const parsed = JSON.parse(stored) as Partial<OrganizationStoreSnapshot>;
      setSnapshot({
        ...DEFAULT_SNAPSHOT,
        ...parsed,
        projectKindsById: parsed.projectKindsById ?? {},
        projectRootFoldersById: parsed.projectRootFoldersById ?? {},
        sourceFiles: Array.isArray(parsed.sourceFiles)
          ? parsed.sourceFiles.map((sourceFile) => ({
              ...sourceFile,
              status: sourceFile.status ?? "available",
            }))
          : [],
        projectReferences: Array.isArray(parsed.projectReferences) ? parsed.projectReferences : [],
        referenceUsages: Array.isArray(parsed.referenceUsages) ? parsed.referenceUsages : [],
        savedDocumentGuards: Array.isArray(parsed.savedDocumentGuards) ? parsed.savedDocumentGuards : [],
      });
    } catch {
      setSnapshot(DEFAULT_SNAPSHOT);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(ORGANIZATION_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Persistência local não deve bloquear o editor.
    }
  }, [snapshot]);

  const setProjectKind = useCallback((projectKind: ProjectKind) => {
    setSnapshot((current) => ({ ...current, projectKind, searchQuery: "" }));
  }, []);

  const setProjectKindForProject = useCallback((projectId: string, projectKind: ProjectKind) => {
    setSnapshot((current) => ({
      ...current,
      projectKindsById: {
        ...current.projectKindsById,
        [projectId]: projectKind,
      },
    }));
  }, []);

  const linkProjectDirectory = useCallback((projectId: string, directory: { handleId: string; name: string }) => {
    setSnapshot((current) => ({
      ...current,
      projectRootFoldersById: {
        ...current.projectRootFoldersById,
        [projectId]: {
          handleId: directory.handleId,
          name: directory.name,
          updatedAt: new Date().toISOString(),
        },
      },
    }));
  }, []);

  const setActiveOrganizationTab = useCallback((activeOrganizationTab: OrganizationTab) => {
    setSnapshot((current) => ({ ...current, activeOrganizationTab, searchQuery: "" }));
  }, []);

  const setActiveReferenceFilter = useCallback((activeReferenceFilter: ReferenceFilter) => {
    setSnapshot((current) => ({ ...current, activeReferenceFilter }));
  }, []);

  const setSearchQuery = useCallback((searchQuery: string) => {
    setSnapshot((current) => ({ ...current, searchQuery }));
  }, []);

  const addSourceFile = useCallback((input: AddSourceFileInput) => {
    const createdAt = new Date().toISOString();
    const sourceFile: SourceFile = {
      id: createClientId("source"),
      projectId: input.projectId,
      name: input.name,
      type: input.type,
      fileHandleId: input.fileHandleId,
      directoryHandleId: input.directoryHandleId,
      fileName: input.fileName,
      fileUrl: input.fileUrl,
      externalUrl: input.externalUrl,
      sizeBytes: input.sizeBytes,
      mimeType: input.mimeType,
      lastModified: input.lastModified,
      rootFolderName: input.rootFolderName,
      status: input.status ?? "available",
      createdAt,
      updatedAt: createdAt,
      metadataStatus: input.metadataStatus ?? inferMetadataStatus(input.bibliographicMetadata),
      bibliographicMetadata: input.bibliographicMetadata,
    };

    let resolvedSourceFile = sourceFile;
    setSnapshot((current) => {
      const existingSource = current.sourceFiles.find(
        (candidate) => candidate.projectId === input.projectId && candidate.name === input.name,
      );

      if (existingSource) {
        resolvedSourceFile = existingSource;
        return current;
      }

      return { ...current, sourceFiles: [...current.sourceFiles, sourceFile] };
    });

    return resolvedSourceFile;
  }, []);

  const addSourceFiles = useCallback((inputs: AddSourceFileInput[]) => {
    const createdAt = new Date().toISOString();
    let createdCount = 0;

    setSnapshot((current) => {
      const nextSourceFiles = [...current.sourceFiles];

      inputs.forEach((input) => {
        const exists = nextSourceFiles.some(
          (candidate) => candidate.projectId === input.projectId && candidate.name === input.name,
        );

        if (exists) return;

        createdCount += 1;
        nextSourceFiles.push({
          id: createClientId("source"),
          projectId: input.projectId,
          name: input.name,
          type: input.type,
          fileHandleId: input.fileHandleId,
          directoryHandleId: input.directoryHandleId,
          fileName: input.fileName,
          fileUrl: input.fileUrl,
          externalUrl: input.externalUrl,
          sizeBytes: input.sizeBytes,
          mimeType: input.mimeType,
          lastModified: input.lastModified,
          rootFolderName: input.rootFolderName,
          status: input.status ?? "available",
          createdAt,
          updatedAt: createdAt,
          metadataStatus: input.metadataStatus ?? inferMetadataStatus(input.bibliographicMetadata),
          bibliographicMetadata: input.bibliographicMetadata,
        });
      });

      if (!createdCount) return current;

      return {
        ...current,
        sourceFiles: nextSourceFiles,
        activeOrganizationTab: "references",
        activeReferenceFilter: "available_sources",
      };
    });

    return createdCount;
  }, []);

  const upsertReference = useCallback((reference: ProjectReference) => {
    setSnapshot((current) => {
      const exists = current.projectReferences.some((candidate) => candidate.id === reference.id);
      return {
        ...current,
        projectReferences: exists
          ? current.projectReferences.map((candidate) => (candidate.id === reference.id ? reference : candidate))
          : [...current.projectReferences, reference],
      };
    });
  }, []);

  const insertCitationFromSource = useCallback((input: InsertCitationFromSourceInput & { projectId: string }) => {
    let createdUsage: ReferenceUsage | null = null;
    let createdReference: ProjectReference | null = null;

    setSnapshot((current) => {
      const ensured = ensureReferenceForSourceFile({
        projectId: input.projectId,
        sourceFileId: input.sourceFileId,
        sourceFiles: current.sourceFiles,
        references: current.projectReferences,
      });
      const usage = createReferenceUsage({
        projectId: input.projectId,
        referenceId: ensured.reference.id,
        sourceFileId: input.sourceFileId,
        usageType: input.usageType,
        quoteText: input.quoteText,
        citationText: input.citationText,
        sourcePage: input.sourcePage,
        sectionId: input.sectionId,
        contextId: input.contextId,
        paragraphId: input.paragraphId,
      });

      createdUsage = usage;
      createdReference = ensured.reference;

      return {
        ...current,
        projectReferences: ensured.references,
        referenceUsages: [...current.referenceUsages, usage],
        sourceFiles: current.sourceFiles.map((sourceFile) =>
          sourceFile.id === input.sourceFileId ? { ...sourceFile, status: "used", updatedAt: new Date().toISOString() } : sourceFile,
        ),
        activeOrganizationTab: "references",
        activeReferenceFilter: "used",
      };
    });

    if (!createdUsage || !createdReference) {
      throw new Error("Não foi possível registrar uso da referência.");
    }

    return {
      usage: createdUsage as ReferenceUsage,
      reference: createdReference as ProjectReference,
    };
  }, []);

  const linkSelectedTextToReference = useCallback((input: LinkSelectedTextToReferenceInput & { projectId: string }) => {
    const usage = createReferenceUsage({
      projectId: input.projectId,
      referenceId: input.referenceId,
      sourceFileId: input.sourceFileId,
      usageType: input.usageType,
      sourcePage: input.sourcePage,
      sectionId: input.sectionId,
      contextId: input.contextId,
      paragraphId: input.paragraphId,
      citationText: input.citationText,
    });

    setSnapshot((current) => ({
      ...current,
      referenceUsages: [...current.referenceUsages, usage],
      activeOrganizationTab: "references",
      activeReferenceFilter: "used",
    }));

    return usage;
  }, []);

  const removeReferenceUsage = useCallback((usageId: string) => {
    setSnapshot((current) => ({
      ...current,
      referenceUsages: current.referenceUsages.filter((usage) => usage.id !== usageId),
    }));
  }, []);

  const removeReferenceIfUnused = useCallback((referenceId: string) => {
    setSnapshot((current) => {
      const hasUsage = current.referenceUsages.some((usage) => usage.referenceId === referenceId);
      if (hasUsage) return current;

      return {
        ...current,
        projectReferences: current.projectReferences.filter((reference) => reference.id !== referenceId),
      };
    });
  }, []);

  const addSavedDocumentGuard = useCallback((input: Omit<SavedDocumentGuard, "id" | "createdAt">) => {
    const guard: SavedDocumentGuard = {
      ...input,
      id: createClientId("saved-guard"),
      createdAt: new Date().toISOString(),
    };

    setSnapshot((current) => ({
      ...current,
      savedDocumentGuards: [guard, ...current.savedDocumentGuards].slice(0, 30),
      activeOrganizationTab: "projects",
    }));

    return guard;
  }, []);

  const preset = useMemo(() => getOrganizationPresetByProjectKind(snapshot.projectKind), [snapshot.projectKind]);

  return {
    ...snapshot,
    preset,
    setProjectKind,
    setProjectKindForProject,
    setActiveOrganizationTab,
    setActiveReferenceFilter,
    setSearchQuery,
    linkProjectDirectory,
    addSourceFile,
    addSourceFiles,
    upsertReference,
    insertCitationFromSource,
    linkSelectedTextToReference,
    removeReferenceUsage,
    removeReferenceIfUnused,
    addSavedDocumentGuard,
  };
}

function createClientId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function inferMetadataStatus(metadata: SourceFile["bibliographicMetadata"]): SourceFile["metadataStatus"] {
  if (!metadata) return "empty";
  if (metadata.title && metadata.author && metadata.year) return "complete";
  if (metadata.title || metadata.author || metadata.year) return "partial";
  return "needs_review";
}

export type OrganizationStoreController = ReturnType<typeof useOrganizationStore>;
