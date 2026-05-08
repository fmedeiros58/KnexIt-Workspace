"use client";

/**
 * ============================================================================
 * TÍTULO DO ARQUIVO
 * ============================================================================
 * Produto: KnexWriter
 * Setor: Painéis laterais / Seções
 * Arquivo: components/knexwriter/panels/SectionPanel.tsx
 *
 * ============================================================================
 * OBJETIVO DO COMPONENTE
 * ============================================================================
 * Renderizar o painel de seções do KnexWriter.
 *
 * Este painel NÃO deve decidir sozinho quando aparece.
 * O Shell/Layout principal decide a abertura do painel direito.
 *
 * Responsabilidades:
 * - Listar seções do projeto ativo
 * - Indicar seção ativa
 * - Selecionar seção para carregar no editor
 * - Criar nova seção
 * - Exibir objetivo, status e quantidade de blocos/chunks
 * - Encaminhar o usuário para projetos quando não houver projeto ativo
 *
 * ============================================================================
 */

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FilePlus2,
  FileText,
  FolderOpen,
  Layers3,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import type { WriterRenderProps } from "../shell/KnexWriterShell";

export type SectionPanelProps = Pick<
  WriterRenderProps,
  "state" | "actions"
> & {
  className?: string;
};

type WriterSection =
  WriterRenderProps["state"]["writingFilteredSections"][number];

function getSectionOrder(section: WriterSection, fallbackIndex: number) {
  if ("order" in section && typeof section.order === "number") {
    return section.order;
  }

  if ("order_index" in section && typeof section.order_index === "number") {
    return section.order_index;
  }

  return fallbackIndex;
}

function getSectionUpdatedAt(section: WriterSection) {
  if ("updated_at" in section && typeof section.updated_at === "string") {
    return section.updated_at;
  }

  if ("updatedAt" in section && typeof section.updatedAt === "string") {
    return section.updatedAt;
  }

  return null;
}

function getSectionStatus(section: WriterSection) {
  const rawStatus =
    "status" in section && typeof section.status === "string"
      ? section.status
      : "planned";

  return rawStatus || "planned";
}

function getStatusLabel(status: string) {
  const normalized = status.toLowerCase();

  if (normalized === "done" || normalized === "completed") return "concluída";
  if (normalized === "draft") return "rascunho";
  if (normalized === "review") return "revisão";
  if (normalized === "active") return "ativa";
  if (normalized === "planned") return "planejada";

  return status;
}

function getStatusClass(status: string) {
  const normalized = status.toLowerCase();

  if (normalized === "done" || normalized === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (normalized === "review") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (normalized === "active" || normalized === "draft") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  return "border-zinc-200 bg-zinc-50 text-zinc-600";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) return "-";

  return new Date(parsed).toLocaleString("pt-BR");
}

function getChunkCount(section: WriterSection) {
  return Array.isArray(section.chunks) ? section.chunks.length : 0;
}

function getSectionWordEstimate(section: WriterSection) {
  const chunks = Array.isArray(section.chunks) ? section.chunks : [];

  if (chunks.length) {
    return chunks.reduce((total: number, chunk: { text?: string }) => {
      const text = typeof chunk.text === "string" ? chunk.text : "";
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;

      return total + words;
    }, 0);
  }

  if ("content" in section && typeof section.content === "string") {
    const content = section.content.trim();

    return content ? content.split(/\s+/).length : 0;
  }

  return 0;
}

export function SectionPanel({
  state,
  actions,
  className = "",
}: SectionPanelProps) {
  const sections = state.writingFilteredSections;
  const activeProjectId = state.writeSession.activeProjectId;
  const activeSectionId = state.writeSession.activeSectionId;
  const isSaving = state.writeSession.isSaving;
  const isGenerating = state.writeSession.isGenerating;

  const handleSelectSection = async (sectionId: string) => {
    await actions.handleSelectWriteSection(sectionId);
  };

  const handleCreateSection = async () => {
    await actions.handleCreateWriteSection();
  };

  return (
    <section
      data-knexwriter-section-panel="true"
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
              Seções
            </p>

            <h2 className="mt-1 flex items-center gap-2 text-sm font-semibold text-zinc-950">
              <Layers3 className="h-4 w-4 text-zinc-500" />
              Estrutura do projeto
            </h2>
          </div>

          <button
            type="button"
            onClick={() => void handleCreateSection()}
            disabled={!activeProjectId || isSaving}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-zinc-900 bg-zinc-950 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400"
            title={
              activeProjectId
                ? "Criar nova seção"
                : "Abra ou crie um projeto antes de criar seções"
            }
          >
            {isSaving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Nova
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
            <p className="text-[11px] font-medium text-zinc-500">
              Seções
            </p>
            <p className="mt-0.5 text-lg font-semibold text-zinc-950">
              {sections.length}
            </p>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
            <p className="text-[11px] font-medium text-zinc-500">
              Ativa
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-zinc-950">
              {state.activeSection?.title || "Nenhuma"}
            </p>
          </div>
        </div>

        <div className="mt-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />

            <input
              value={state.writingWorksQuery}
              onChange={(event) =>
                actions.setWritingWorksQuery(event.currentTarget.value)
              }
              placeholder="Buscar seção..."
              className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-8 pr-3 text-xs text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </label>
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

        {state.writeSession.saveError ? (
          <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs leading-relaxed text-rose-700">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{state.writeSession.saveError}</p>
            </div>
          </div>
        ) : null}

        {!activeProjectId ? (
          <NoActiveProjectState
            onOpenProjects={() => actions.setWritingRightPanelTab("projects")}
          />
        ) : !sections.length ? (
          <EmptySectionsState
            hasQuery={state.writingWorksQuery.trim().length > 0}
            isSaving={isSaving}
            onCreateSection={handleCreateSection}
          />
        ) : (
          <div className="space-y-2">
            {sections.map((section: WriterSection, index: number) => (
              <SectionCard
                key={section.section_id}
                section={section}
                index={index}
                isActive={section.section_id === activeSectionId}
                isBusy={isSaving || isGenerating}
                onSelect={() => void handleSelectSection(section.section_id)}
              />
            ))}
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-zinc-200 px-4 py-3">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Estado
            </p>

            {state.writeSession.hasUnsavedChanges ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                alterações
              </span>
            ) : (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                sincronizado
              </span>
            )}
          </div>

          <p className="mt-1 truncate text-xs text-zinc-700">
            Projeto: {state.activeProject?.title || "Nenhum projeto ativo"}
          </p>

          <p className="mt-0.5 truncate text-xs text-zinc-500">
            Última sincronização: {formatDateTime(state.writeSession.lastSyncedAt)}
          </p>
        </div>
      </footer>
    </section>
  );
}

function SectionCard({
  section,
  index,
  isActive,
  isBusy,
  onSelect,
}: {
  section: WriterSection;
  index: number;
  isActive: boolean;
  isBusy: boolean;
  onSelect: () => void;
}) {
  const order = getSectionOrder(section, index);
  const status = getSectionStatus(section);
  const chunkCount = getChunkCount(section);
  const wordEstimate = getSectionWordEstimate(section);
  const updatedAt = getSectionUpdatedAt(section);

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isBusy && isActive}
      className={[
        "group block w-full rounded-lg border p-3 text-left text-sm shadow-sm transition disabled:cursor-wait disabled:opacity-75",
        isActive
          ? "border-blue-300 bg-blue-50"
          : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div
          className={[
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
            isActive
              ? "bg-blue-100 text-blue-700"
              : "bg-zinc-100 text-zinc-500 group-hover:text-zinc-700",
          ].join(" ")}
        >
          {order + 1}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 font-semibold leading-snug text-zinc-900">
              {section.title || "Seção sem título"}
            </p>

            <span
              className={[
                "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                getStatusClass(status),
              ].join(" ")}
            >
              {getStatusLabel(status)}
            </span>
          </div>

          {section.objective ? (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500">
              {section.objective}
            </p>
          ) : (
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              Sem objetivo registrado para esta seção.
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-400">
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              {chunkCount} bloco{chunkCount === 1 ? "" : "s"}
            </span>

            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {wordEstimate} palavra{wordEstimate === 1 ? "" : "s"}
            </span>

            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatDateTime(updatedAt)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function NoActiveProjectState({
  onOpenProjects,
}: {
  onOpenProjects: () => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-zinc-100 p-2 text-zinc-600">
          <FolderOpen className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-semibold text-zinc-800">
            Nenhum projeto ativo.
          </p>

          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Abra ou crie um projeto antes de organizar seções.
          </p>

          <button
            type="button"
            onClick={onOpenProjects}
            className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            <FolderOpen className="h-4 w-4" />
            Ver projetos
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptySectionsState({
  hasQuery,
  isSaving,
  onCreateSection,
}: {
  hasQuery: boolean;
  isSaving: boolean;
  onCreateSection: () => void | Promise<void>;
}) {
  if (hasQuery) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm">
        <p className="font-semibold text-zinc-800">
          Nenhuma seção encontrada para a busca.
        </p>

        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Limpe a busca ou tente outro termo para localizar uma seção do projeto.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
          <FilePlus2 className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-semibold text-zinc-800">
            Nenhuma seção encontrada.
          </p>

          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Crie uma seção para começar a organizar capítulos, partes ou blocos
            do documento.
          </p>

          <button
            type="button"
            onClick={() => void onCreateSection()}
            disabled={isSaving}
            className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Criar seção
          </button>
        </div>
      </div>
    </div>
  );
}

export default SectionPanel;