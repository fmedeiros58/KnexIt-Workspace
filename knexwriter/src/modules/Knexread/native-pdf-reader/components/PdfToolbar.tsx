"use client";

import type { PdfReaderSidebarMode } from "../types";

const ZOOM_PRESETS = [
  10,
  25,
  50,
  75,
  100,
  125,
  150,
  175,
  200,
  250,
  300,
  400,
  500,
  600,
  800,
  1000,
  1600,
  2400,
  3200,
  4000,
  6400,
  8000,
];

export function PdfToolbar({
  page,
  pageCount,
  zoom,
  sidebarMode,
  onGoToPreviousPage,
  onGoToNextPage,
  onGoToPage,
  onZoomIn,
  onZoomOut,
  onZoomChange,
  onSidebarModeChange,
  onClose,
  showCloseButton = true,
}: {
  page: number;
  pageCount: number;
  zoom: number;
  sidebarMode: PdfReaderSidebarMode;
  onGoToPreviousPage: () => void;
  onGoToNextPage: () => void;
  onGoToPage: (page: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomChange: (zoom: number) => void;
  onSidebarModeChange: (mode: PdfReaderSidebarMode) => void;
  onClose: () => void;
  showCloseButton?: boolean;
}) {
  return (
    <footer className="flex h-14 shrink-0 items-center gap-3 border-t border-zinc-800 bg-zinc-950 px-3 text-zinc-100">
      <button
        type="button"
        onClick={onGoToPreviousPage}
        className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs hover:bg-zinc-800"
      >
        {"<"}
      </button>
      <button
        type="button"
        onClick={onGoToNextPage}
        className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs hover:bg-zinc-800"
      >
        {">"}
      </button>
      <label className="text-xs text-zinc-200">
        Página
        <input
          value={page}
          onChange={(event) => onGoToPage(Number(event.target.value || 1))}
          className="ml-1 w-14 rounded-md border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-center text-xs text-zinc-100"
        />
        <span className="ml-1">/ {pageCount}</span>
      </label>
      <div className="ml-3 flex items-center gap-1">
        <button
          type="button"
          onClick={onZoomOut}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs hover:bg-zinc-800"
        >
          -
        </button>
        <input
          type="range"
          min={10}
          max={8000}
          value={zoom}
          onChange={(event) => onZoomChange(Number(event.target.value))}
          className="w-24"
        />
        <input
          type="number"
          min={10}
          max={8000}
          value={zoom}
          onChange={(event) => onZoomChange(Number(event.target.value || 100))}
          className="w-16 rounded-md border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-center text-xs text-zinc-100"
          aria-label="Zoom manual"
        />
        <select
          value={ZOOM_PRESETS.includes(zoom) ? String(zoom) : ""}
          onChange={(event) => {
            const nextZoom = Number(event.target.value);
            if (nextZoom) onZoomChange(nextZoom);
          }}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-1 py-1 text-xs text-zinc-100"
          aria-label="Presets de zoom"
        >
          <option value="">Preset</option>
          {ZOOM_PRESETS.map((preset) => (
            <option key={preset} value={preset}>
              {preset}%
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onZoomIn}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs hover:bg-zinc-800"
        >
          +
        </button>
        <span className="text-xs text-zinc-200">{zoom}%</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <select
          value={sidebarMode}
          onChange={(event) =>
            onSidebarModeChange(event.target.value as PdfReaderSidebarMode)
          }
          className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
        >
          <option value="thumbnails">Miniaturas</option>
          <option value="annotations">Anotações</option>
          <option value="search">Busca</option>
          <option value="source-info">Fonte</option>
          <option value="none">Sem painel</option>
        </select>
        {showCloseButton ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs hover:bg-zinc-800"
          >
            Fechar
          </button>
        ) : null}
      </div>
    </footer>
  );
}
