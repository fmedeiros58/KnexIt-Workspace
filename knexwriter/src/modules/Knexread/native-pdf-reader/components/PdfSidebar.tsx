"use client";

import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Layers3,
  Link2,
  Lock,
  MessageCircle,
  Search,
} from "lucide-react";
import { useCallback, useRef, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import type {
  PdfAnnotationRecord,
  PdfCitationRecord,
  PdfHighlightRecord,
  PdfReaderSidebarMode,
  PdfTranslationBlockRecord,
} from "../types";

export function PdfSidebar({
  mode,
  onModeChange,
  collapsed,
  onToggleCollapsed,
  panelWidth,
  onPanelWidthChange,
  highlights,
  annotations,
  citations,
  translationBlocks,
  onSelectPage,
  renderThumbnails,
  renderSearch,
  renderSourceInfo,
}: {
  mode: PdfReaderSidebarMode;
  onModeChange: (mode: PdfReaderSidebarMode) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  panelWidth: number;
  onPanelWidthChange: (width: number) => void;
  highlights: PdfHighlightRecord[];
  annotations: PdfAnnotationRecord[];
  citations: PdfCitationRecord[];
  translationBlocks?: PdfTranslationBlockRecord[];
  onSelectPage: (pageNumber: number) => void;
  renderThumbnails: () => ReactNode;
  renderSearch: () => ReactNode;
  renderSourceInfo: () => ReactNode;
}) {
  const panelVisible = !collapsed && mode !== "none";
  const dragStateRef = useRef<{
    startX: number;
    startWidth: number;
    moved: boolean;
  } | null>(null);

  const handleSelectMode = (nextMode: PdfReaderSidebarMode) => {
    onModeChange(nextMode);
    if (collapsed) {
      onToggleCollapsed();
    }
  };

  const startResize = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragStateRef.current = {
        startX: event.clientX,
        startWidth: panelWidth,
        moved: false,
      };

      const handleMove = (moveEvent: MouseEvent) => {
        const state = dragStateRef.current;
        if (!state) return;
        const delta = moveEvent.clientX - state.startX;
        const viewportMax = Math.max(240, Math.floor(window.innerWidth * 0.5) - 64);
        if (Math.abs(delta) > 3) {
          state.moved = true;
        }
        onPanelWidthChange(Math.max(240, Math.min(viewportMax, state.startWidth + delta)));
      };

      const handleUp = () => {
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp, { once: true });
    },
    [onPanelWidthChange, panelWidth],
  );

  const handleDividerClick = () => {
    const wasDrag = dragStateRef.current?.moved;
    dragStateRef.current = null;
    if (!wasDrag) {
      onToggleCollapsed();
    }
  };

  return (
    <aside className="flex h-full shrink-0 border-r border-zinc-300 bg-zinc-50">
      <div className="flex w-12 flex-col items-center border-r border-zinc-200 bg-zinc-100/80 py-2">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
          title={collapsed ? "Expandir painel" : "Contrair painel"}
          aria-label={collapsed ? "Expandir painel" : "Contrair painel"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        <div className="flex flex-col gap-1">
          <RailButton
            icon={<FileText size={16} />}
            active={mode === "thumbnails"}
            label="Páginas"
            onClick={() => handleSelectMode("thumbnails")}
          />
          <RailButton
            icon={<Search size={16} />}
            active={mode === "search"}
            label="Busca"
            onClick={() => handleSelectMode("search")}
          />
          <RailButton
            icon={<MessageCircle size={16} />}
            active={mode === "annotations"}
            label="Anotações"
            onClick={() => handleSelectMode("annotations")}
          />
          <RailButton
            icon={<Layers3 size={16} />}
            active={mode === "source-info"}
            label="Fonte"
            onClick={() => handleSelectMode("source-info")}
          />
          <RailButton
            icon={<Link2 size={16} />}
            active={false}
            label="Citações"
            onClick={() => handleSelectMode("annotations")}
          />
          <RailButton
            icon={<Bookmark size={16} />}
            active={false}
            label="Marcadores"
            onClick={() => handleSelectMode("annotations")}
          />
          <RailButton
            icon={<ClipboardList size={16} />}
            active={false}
            label="Revisão"
            onClick={() => handleSelectMode("annotations")}
          />
          <RailButton
            icon={<Lock size={16} />}
            active={false}
            label="Proteção"
            onClick={() => handleSelectMode("source-info")}
          />
        </div>
      </div>

      {panelVisible ? (
        <div
          className="flex min-w-[240px] flex-col"
          style={{ width: `${panelWidth}px` }}
        >
          <header className="border-b border-zinc-200 px-3 py-3">
            <p className="text-[22px] font-light leading-none text-zinc-700">
              {modeTitle(mode)}
            </p>
            <div className="mt-2 flex items-center gap-1 text-zinc-500">
              <PanelModeButton
                active={mode === "thumbnails"}
                title="Miniaturas"
                onClick={() => handleSelectMode("thumbnails")}
              >
                <FileText size={14} />
              </PanelModeButton>
              <PanelModeButton
                active={mode === "search"}
                title="Busca"
                onClick={() => handleSelectMode("search")}
              >
                <Search size={14} />
              </PanelModeButton>
              <PanelModeButton
                active={mode === "annotations"}
                title="Anotações"
                onClick={() => handleSelectMode("annotations")}
              >
                <MessageCircle size={14} />
              </PanelModeButton>
              <PanelModeButton
                active={mode === "source-info"}
                title="Fonte"
                onClick={() => handleSelectMode("source-info")}
              >
                <Layers3 size={14} />
              </PanelModeButton>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {mode === "thumbnails" ? renderThumbnails() : null}
            {mode === "search" ? renderSearch() : null}
            {mode === "source-info" ? renderSourceInfo() : null}
            {mode === "annotations" ? (
              <div className="space-y-2 text-xs">
                <AnnotationSection title="Destaques" emptyText="Sem destaques.">
                  {highlights.map((highlight) => (
                    <button
                      key={highlight.id}
                      type="button"
                      onClick={() => onSelectPage(highlight.pageNumber)}
                      className="block w-full rounded border border-zinc-200 px-2 py-1 text-left hover:bg-zinc-100"
                    >
                      p.{highlight.pageNumber}: {highlight.selectedText.slice(0, 90)}
                    </button>
                  ))}
                </AnnotationSection>

                <AnnotationSection title="Comentários" emptyText="Sem comentários.">
                  {annotations.map((annotation) => (
                    <button
                      key={annotation.id}
                      type="button"
                      onClick={() => onSelectPage(annotation.pageNumber)}
                      className="block w-full rounded border border-zinc-200 px-2 py-1 text-left hover:bg-zinc-100"
                    >
                      p.{annotation.pageNumber}: {annotation.content.slice(0, 90)}
                    </button>
                  ))}
                </AnnotationSection>

                <AnnotationSection title="Citações" emptyText="Sem citações.">
                  {citations.map((citation) => (
                    <button
                      key={citation.id}
                      type="button"
                      onClick={() => onSelectPage(citation.pageNumber ?? 1)}
                      className="block w-full rounded border border-zinc-200 px-2 py-1 text-left hover:bg-zinc-100"
                    >
                      {citation.citationType} p.{citation.pageNumber ?? "-"}
                    </button>
                  ))}
                </AnnotationSection>

                <AnnotationSection
                  title="Problemas de tradução"
                  emptyText="Sem overflow/erro."
                >
                  {(translationBlocks ?? [])
                    .filter((block) => block.status === "overflow" || block.status === "error")
                    .slice(0, 80)
                    .map((block) => (
                      <button
                        key={block.id}
                        type="button"
                        onClick={() => onSelectPage(block.pageNumber)}
                        className="block w-full rounded border border-zinc-200 px-2 py-1 text-left hover:bg-zinc-100"
                      >
                        p.{block.pageNumber}: {block.status}
                      </button>
                    ))}
                </AnnotationSection>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={startResize}
        onClick={handleDividerClick}
        className="relative flex w-3 shrink-0 cursor-col-resize items-center justify-center border-l border-r border-zinc-300 bg-zinc-100 hover:bg-zinc-200"
        title={collapsed ? "Expandir painel" : "Arrastar para redimensionar ou clicar para recolher"}
      >
        <span className="absolute top-1/2 flex h-9 w-3 -translate-y-1/2 items-center justify-center border border-zinc-400 bg-zinc-200 text-[10px] text-zinc-700">
          {collapsed ? "›" : "‹"}
        </span>
      </div>
    </aside>
  );
}

function modeTitle(mode: PdfReaderSidebarMode) {
  if (mode === "thumbnails") return "Páginas";
  if (mode === "search") return "Busca";
  if (mode === "annotations") return "Anotações";
  if (mode === "source-info") return "Fonte";
  return "Painel";
}

function PanelModeButton({
  active,
  title,
  onClick,
  children,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-6 w-6 items-center justify-center rounded border ${
        active
          ? "border-violet-300 bg-violet-100 text-violet-700"
          : "border-transparent hover:border-zinc-300 hover:bg-zinc-100"
      }`}
      title={title}
    >
      {children}
    </button>
  );
}

function RailButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 w-10 items-center justify-center rounded border transition-colors ${
        active
          ? "border-violet-300 bg-violet-100 text-violet-700"
          : "border-transparent bg-transparent text-zinc-600 hover:border-zinc-300 hover:bg-white"
      }`}
      title={label}
      aria-label={label}
    >
      {icon}
    </button>
  );
}

function AnnotationSection({
  title,
  emptyText,
  children,
}: {
  title: string;
  emptyText: string;
  children: ReactNode;
}) {
  const hasChildren =
    Array.isArray(children) ? children.filter(Boolean).length > 0 : Boolean(children);

  return (
    <section className="rounded border border-zinc-200 bg-white p-2">
      <p className="mb-1 font-semibold text-zinc-700">{title}</p>
      {hasChildren ? <div className="space-y-1">{children}</div> : <p className="text-zinc-500">{emptyText}</p>}
    </section>
  );
}
