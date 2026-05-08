"use client";

import { ChevronRight } from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { ContextsPanel } from "./contexts/ContextsPanel";
import { SourceFilesPanel, type ImportedDocumentSummary } from "./files/SourceFilesPanel";
import { NotesPanel } from "./notes/NotesPanel";
import {
  ORGANIZATION_TAB_LABEL,
  PROJECT_KIND_LABEL,
  type InsertCitationFromSourceInput,
  type OrganizationContextItem,
  type OrganizationProjectItem,
  type OrganizationSectionItem,
  type ProjectKind,
  type SourceFileType,
} from "./organizationTypes";
import type { OrganizationStoreController } from "./organizationStore";
import { OrganizationSearch } from "./OrganizationSearch";
import { OrganizationTabs } from "./OrganizationTabs";
import { ProjectsPanel } from "./projects/ProjectsPanel";
import { ReferencesPanel } from "./references/ReferencesPanel";
import { RevisionsPanel } from "./revisions/RevisionsPanel";
import { SectionsPanel } from "./sections/SectionsPanel";
import { StructurePanel } from "./structure/StructurePanel";

export type OrganizationPanelProps = {
  widthPercent: number;
  organization: OrganizationStoreController;
  projects: OrganizationProjectItem[];
  sections: OrganizationSectionItem[];
  contexts: OrganizationContextItem[];
  activeProjectId: string | null;
  activeSectionId: string | null;
  importedDocument: ImportedDocumentSummary | null;
  onCollapse: () => void;
  onResizeStart: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onOpenProject: (projectId: string) => void;
  onOpenSection: (sectionId: string) => void;
  onOpenFilePicker: () => void;
  onLinkProjectDirectory: () => void;
  onLinkSourceFiles: () => void;
  onAddManualReference: () => void;
  isFileSystemAccessAvailable: boolean;
  onInsertCitationFromSource: (input: InsertCitationFromSourceInput) => void;
  onRegisterSourceFile: (input: { name: string; type: SourceFileType }) => void;
};

export function OrganizationPanel({
  widthPercent,
  organization,
  projects,
  sections,
  contexts,
  activeProjectId,
  activeSectionId,
  importedDocument,
  onCollapse,
  onResizeStart,
  onOpenProject,
  onOpenSection,
  onOpenFilePicker,
  onLinkProjectDirectory,
  onLinkSourceFiles,
  onAddManualReference,
  isFileSystemAccessAvailable,
  onInsertCitationFromSource,
  onRegisterSourceFile,
}: OrganizationPanelProps) {
  const activeTab = organization.activeOrganizationTab === "more" ? "files" : organization.activeOrganizationTab;
  const activeProject = projects.find((project) => project.project_id === activeProjectId) ?? null;
  const activeSection = sections.find((section) => section.section_id === activeSectionId) ?? null;
  const activeSavedGuard = organization.savedDocumentGuards.find((guard) => guard.projectId === activeProjectId) ?? null;

  return (
    <aside
      className="relative flex min-h-0 shrink-0 flex-col border-l border-zinc-300 bg-[#f7f7f8]"
      style={{ width: `${widthPercent}%` }}
    >
      <div className="flex h-11 items-center justify-between border-b border-zinc-300 px-3">
        <div className="min-w-0">
          <span className="text-sm font-semibold text-zinc-700">Organização</span>
          <p className="truncate text-[10px] text-zinc-500">{organization.preset.terminology.references}</p>
        </div>

        <button
          type="button"
          onClick={onCollapse}
          className="rounded-md p-1 hover:bg-zinc-200"
          aria-label="Recolher painel direito"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="border-b border-zinc-300 px-3 py-2">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500" htmlFor="knexwriter-project-kind">
          Tipo do projeto
        </label>
        <select
          id="knexwriter-project-kind"
          value={organization.projectKind}
          onChange={(event) => organization.setProjectKind(event.target.value as ProjectKind)}
          className="mt-1 h-8 w-full rounded-md border border-zinc-300 bg-white px-2 text-xs font-medium text-zinc-700 outline-none"
        >
          {Object.entries(PROJECT_KIND_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <div className="mt-2 space-y-1 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[11px] text-zinc-600">
          <p className="truncate">
            <span className="font-semibold">Projeto ativo:</span> {activeProject?.title ?? activeSavedGuard?.title ?? "Sem projeto selecionado"}
          </p>
          <p className="truncate">
            <span className="font-semibold">Seção ativa:</span> {activeSection?.title ?? "Sem seção selecionada"}
          </p>
        </div>
      </div>

      <OrganizationTabs activeTab={organization.activeOrganizationTab} onChange={organization.setActiveOrganizationTab} />
      <OrganizationSearch activeTab={activeTab} value={organization.searchQuery} onChange={organization.setSearchQuery} />

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {activeTab === "projects" ? (
          <ProjectsPanel
            projects={projects}
            savedDocumentGuards={organization.savedDocumentGuards}
            activeProjectId={activeProjectId}
            activeProjectKind={organization.projectKind}
            projectKindsById={organization.projectKindsById}
            query={organization.searchQuery}
            onOpenProject={onOpenProject}
            onAssignProjectKind={organization.setProjectKindForProject}
          />
        ) : null}

        {activeTab === "sections" ? (
          <SectionsPanel
            sections={sections}
            activeSectionId={activeSectionId}
            query={organization.searchQuery}
            label={organization.preset.terminology.sections}
            onOpenSection={onOpenSection}
          />
        ) : null}

        {activeTab === "contexts" ? <ContextsPanel contexts={contexts} query={organization.searchQuery} /> : null}

        {activeTab === "references" ? (
          <ReferencesPanel
            projectId={activeProjectId}
            sourceFiles={organization.sourceFiles}
            references={organization.projectReferences}
            usages={organization.referenceUsages}
            query={organization.searchQuery}
            activeFilter={organization.activeReferenceFilter}
            onFilterChange={organization.setActiveReferenceFilter}
            onRemoveReference={organization.removeReferenceIfUnused}
            onRemoveUsage={organization.removeReferenceUsage}
            importedDocument={importedDocument}
            onOpenFilePicker={onOpenFilePicker}
            onLinkProjectDirectory={onLinkProjectDirectory}
            onLinkSourceFiles={onLinkSourceFiles}
            onAddManualReference={onAddManualReference}
            isFileSystemAccessAvailable={isFileSystemAccessAvailable}
            onRegisterSourceFile={onRegisterSourceFile}
            onInsertCitationFromSource={onInsertCitationFromSource}
          />
        ) : null}

        {activeTab === "structure" ? <StructurePanel sections={sections} query={organization.searchQuery} /> : null}
        {activeTab === "notes" ? <NotesPanel /> : null}
        {activeTab === "revisions" ? <RevisionsPanel /> : null}

        {activeTab === "files" ? (
          <SourceFilesPanel
            projectId={activeProjectId}
            sourceFiles={organization.sourceFiles}
            usages={organization.referenceUsages}
            query={organization.searchQuery}
            importedDocument={importedDocument}
            onOpenFilePicker={onLinkSourceFiles}
            onRegisterImportedDocument={onRegisterSourceFile}
            onInsertCitationFromSource={onInsertCitationFromSource}
          />
        ) : null}

        {activeTab === "archived" || activeTab === "trash" || activeTab === "settings" ? (
          <ReservedPanel title={ORGANIZATION_TAB_LABEL[activeTab]} />
        ) : null}
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={onResizeStart}
        className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-300"
      />
    </aside>
  );
}

function ReservedPanel({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm">
      <p className="font-medium text-zinc-800">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500">Área estrutural preparada para a próxima etapa.</p>
    </div>
  );
}


