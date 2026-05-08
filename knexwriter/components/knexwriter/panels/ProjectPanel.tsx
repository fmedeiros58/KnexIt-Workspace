"use client";

/**
 * ============================================================================
 * TÍTULO DO ARQUIVO
 * ============================================================================
 * Produto: KnexWriter
 * Setor: Painéis laterais / Projetos
 * Arquivo: components/knexwriter/panels/ProjectPanel.tsx
 *
 * ============================================================================
 * OBJETIVO DO COMPONENTE
 * ============================================================================
 * Renderizar o painel de projetos do KnexWriter.
 *
 * Este painel NÃO deve decidir sozinho quando aparece.
 * O Shell/Layout principal decide a abertura do painel direito.
 *
 * Responsabilidades:
 * - Listar projetos filtrados
 * - Indicar projeto ativo
 * - Abrir projeto selecionado
 * - Atualizar lista de projetos
 * - Encaminhar criação de novo projeto para o backstage/fluxo próprio
 * - Permitir busca compartilhada pelo painel direito
 *
 * ============================================================================
 */

import {
  AlertTriangle,
  Clock,
  FileText,
  FolderOpen,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import type { WriterRenderProps } from "../shell/KnexWriterShell";

export type ProjectPanelProps = Pick<
  WriterRenderProps,
  "state" | "actions"
> & {
  className?: string;
};

type WriterProject = WriterRenderProps["state"]["writingFilteredProjects"][number];

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) return "-";

  return new Date(parsed).toLocaleString("pt-BR");
}

function getProjectDescription(project: WriterProject) {
  if ("description" in project && typeof project.description === "string") {
    return project.description;
  }

  return "";
}

function getProjectUpdatedAt(project: WriterProject) {
  if ("updated_at" in project && typeof project.updated_at === "string") {
    return project.updated_at;
  }

  if ("updatedAt" in project && typeof project.updatedAt === "string") {
    return project.updatedAt;
  }

  return null;
}

export function ProjectPanel({
  state,
  actions,
  className = "",
}: ProjectPanelProps) {
  const projects = state.writingFilteredProjects;
  const activeProjectId = state.writeSession.activeProjectId;
  const isSaving = state.writeSession.isSaving;

  const handleOpenProject = async (projectId: string) => {
    await actions.openWriteProjectSession(projectId, null);
    actions.setWritingRightPanelTab("sections");
  };

  const handleRefreshProjects = async () => {
    await actions.refreshWriteProjects();
  };

  const handleCreateProject = () => {
    actions.handleSelectBackstageTab("new");
  };

  return (
    <section
      data-knexwriter-project-panel="true"
      className={[
        "flex h-full min-h-0 flex-col bg-white text-zinc-900",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="shrink-0 border-b border-zinc-200 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Projetos
            </p>

            <h2 className="mt-1 flex items-center gap-2 text-sm font-semibold text-zinc-950">
              <FolderOpen className="h-4 w-4 text-zinc-500" />
              Projetos de escrita
            </h2>
          </div>

          <button
            type="button"
            onClick={handleRefreshProjects}
            disabled={isSaving}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            title="Atualizar projetos"
            aria-label="Atualizar projetos"
          >
            <RefreshCw className={["h-4 w-4", isSaving ? "animate-spin" : ""].join(" ")} />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
            <p className="text-[11px] font-medium text-zinc-500">
              Projetos
            </p>
            <p className="mt-0.5 text-lg font-semibold text-zinc-950">
              {projects.length}
            </p>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
            <p className="text-[11px] font-medium text-zinc-500">
              Ativo
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-zinc-950">
              {state.activeProject?.title || "Nenhum"}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />

            <input
              value={state.writingWorksQuery}
              onChange={(event) =>
                actions.setWritingWorksQuery(event.currentTarget.value)
              }
              placeholder="Buscar projeto..."
              className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-8 pr-3 text-xs text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <button
            type="button"
            onClick={handleCreateProject}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-zinc-900 bg-zinc-950 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800"
            title="Criar novo projeto"
          >
            <Plus className="h-4 w-4" />
            Novo
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {state.writingError ? (
          <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs leading-relaxed text-rose-700">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{state.writingError}</p>
            </div>
          </div>
        ) : null}

        {state.writingNotice ? (
          <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-700">
            {state.writingNotice}
          </div>
        ) : null}

        {!projects.length ? (
          <EmptyProjectPanel
            hasQuery={state.writingWorksQuery.trim().length > 0}
            onCreateProject={handleCreateProject}
            onRefreshProjects={handleRefreshProjects}
          />
        ) : (
          <div className="space-y-2">
            {projects.map((project: WriterProject) => (
              <ProjectCard
                key={project.project_id}
                project={project}
                isActive={activeProjectId === project.project_id}
                isLoading={
                  isSaving && activeProjectId === project.project_id
                }
                onOpen={() => void handleOpenProject(project.project_id)}
              />
            ))}
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-zinc-200 px-4 py-3">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
            Sessão atual
          </p>

          <p className="mt-1 truncate text-xs text-zinc-700">
            Projeto: {state.activeProject?.title || "Nenhum projeto ativo"}
          </p>

          <p className="mt-0.5 truncate text-xs text-zinc-500">
            Seção: {state.activeSection?.title || "Nenhuma seção ativa"}
          </p>
        </div>
      </footer>
    </section>
  );
}

function ProjectCard({
  project,
  isActive,
  isLoading,
  onOpen,
}: {
  project: WriterProject;
  isActive: boolean;
  isLoading: boolean;
  onOpen: () => void;
}) {
  const description = getProjectDescription(project);
  const updatedAt = getProjectUpdatedAt(project);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={[
        "group block w-full rounded-lg border p-3 text-left text-sm shadow-sm transition",
        isActive
          ? "border-blue-300 bg-blue-50"
          : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div
          className={[
            "mt-0.5 rounded-lg p-2",
            isActive
              ? "bg-blue-100 text-blue-700"
              : "bg-zinc-100 text-zinc-500 group-hover:text-zinc-700",
          ].join(" ")}
        >
          {isLoading ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 font-semibold leading-snug text-zinc-900">
              {project.title || "Projeto sem título"}
            </p>

            {isActive ? (
              <span className="shrink-0 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                ativo
              </span>
            ) : null}
          </div>

          {description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500">
              {description}
            </p>
          ) : (
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              Sem descrição registrada.
            </p>
          )}

          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-400">
            <Clock className="h-3.5 w-3.5" />
            <span>Atualizado: {formatDateTime(updatedAt)}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function EmptyProjectPanel({
  hasQuery,
  onCreateProject,
  onRefreshProjects,
}: {
  hasQuery: boolean;
  onCreateProject: () => void;
  onRefreshProjects: () => void | Promise<void>;
}) {
  if (hasQuery) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm">
        <p className="font-semibold text-zinc-800">
          Nenhum projeto encontrado para a busca.
        </p>

        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Limpe a busca ou tente outro termo para localizar seus projetos.
        </p>

        <button
          type="button"
          onClick={() => void onRefreshProjects()}
          className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar lista
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm">
      <p className="font-semibold text-zinc-800">
        Nenhum projeto encontrado.
      </p>

      <p className="mt-1 text-xs leading-relaxed text-zinc-500">
        Crie um projeto para organizar seções, fontes, rascunhos e versões do
        documento.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCreateProject}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-900 bg-zinc-950 px-3 text-xs font-semibold text-white transition hover:bg-zinc-800"
        >
          <Plus className="h-4 w-4" />
          Criar projeto
        </button>

        <button
          type="button"
          onClick={() => void onRefreshProjects()}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </button>
      </div>
    </div>
  );
}

export default ProjectPanel;