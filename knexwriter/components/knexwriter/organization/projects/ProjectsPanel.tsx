"use client";

import {
  PROJECT_KIND_LABEL,
  type OrganizationProjectItem,
  type ProjectKind,
  type SavedDocumentGuard,
} from "../organizationTypes";

export function ProjectsPanel({
  projects,
  savedDocumentGuards,
  activeProjectId,
  activeProjectKind,
  projectKindsById,
  query,
  onOpenProject,
  onAssignProjectKind,
}: {
  projects: OrganizationProjectItem[];
  savedDocumentGuards: SavedDocumentGuard[];
  activeProjectId: string | null;
  activeProjectKind: ProjectKind;
  projectKindsById: Record<string, ProjectKind>;
  query: string;
  onOpenProject: (projectId: string) => void;
  onAssignProjectKind: (projectId: string, projectKind: ProjectKind) => void;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const typedProjects = projects.filter((project) => projectKindsById[project.project_id] === activeProjectKind);
  const unclassifiedProjects = projects.filter((project) => !projectKindsById[project.project_id]);
  const filteredProjects = normalizedQuery
    ? typedProjects.filter((project) => `${project.title} ${project.description ?? ""}`.toLowerCase().includes(normalizedQuery))
    : typedProjects;
  const filteredGuards = normalizedQuery
    ? savedDocumentGuards.filter(
        (guard) =>
          guard.projectKind === activeProjectKind &&
          `${guard.title} ${guard.fileName}`.toLowerCase().includes(normalizedQuery),
      )
    : savedDocumentGuards.filter((guard) => guard.projectKind === activeProjectKind);

  if (!filteredProjects.length && !filteredGuards.length && !unclassifiedProjects.length) {
    return <EmptyOrganizationState title="Nenhum projeto encontrado." description="Crie ou selecione um projeto para organizar a escrita." />;
  }

  return (
    <div className="space-y-2">
      {filteredGuards.length ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Arquivos salvos com guards</p>
          {filteredGuards.map((guard) => (
            <article
              key={guard.id}
              className={`rounded-lg border p-3 text-sm ${
                guard.projectId === activeProjectId ? "border-blue-300 bg-blue-50" : "border-zinc-300 bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-900">{guard.title}</p>
                  <p className="mt-1 truncate text-xs text-zinc-500">{guard.fileName}</p>
                </div>
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] uppercase text-zinc-600">
                  {guard.format}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[10px] text-zinc-500">
                <span className="rounded-md bg-white/80 px-1 py-1">Fontes {guard.sourceFileCount}</span>
                <span className="rounded-md bg-white/80 px-1 py-1">Usadas {guard.usedReferenceCount}</span>
                <span className="rounded-md bg-white/80 px-1 py-1">Pend. {guard.auditIssueCount}</span>
              </div>
              {guard.guardIssues[0] ? (
                <p className="mt-2 line-clamp-2 text-[11px] text-zinc-600">{guard.guardIssues[0].message}</p>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      {filteredProjects.map((project) => (
        <button
          key={project.project_id}
          type="button"
          onClick={() => onOpenProject(project.project_id)}
          className={`block w-full rounded-lg border p-3 text-left text-sm ${
            activeProjectId === project.project_id
              ? "border-zinc-900 bg-white"
              : "border-zinc-300 bg-white hover:bg-zinc-100"
          }`}
        >
          <p className="font-medium text-zinc-900">{project.title}</p>
          {project.description ? <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{project.description}</p> : null}
          {project.updated_at ? <p className="mt-2 text-[11px] text-zinc-400">Atualizado: {formatDate(project.updated_at)}</p> : null}
        </button>
      ))}

      {unclassifiedProjects.length ? (
        <div className="space-y-2 pt-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Projetos sem tipo definido</p>
          {unclassifiedProjects.slice(0, 6).map((project) => (
            <article key={project.project_id} className="rounded-lg border border-dashed border-zinc-300 bg-white p-3 text-sm">
              <p className="font-medium text-zinc-900">{project.title}</p>
              {project.description ? <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{project.description}</p> : null}
              <button
                type="button"
                onClick={() => onAssignProjectKind(project.project_id, activeProjectKind)}
                className="mt-2 rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Classificar como {PROJECT_KIND_LABEL[activeProjectKind]}
              </button>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EmptyOrganizationState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm">
      <p className="font-medium text-zinc-800">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500">{description}</p>
    </div>
  );
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
