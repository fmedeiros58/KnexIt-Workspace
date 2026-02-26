"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Columns2, Expand, LayoutGrid, List, Minus, Plus } from "lucide-react";
import { clamp } from "../lib/utils";

type Props = {
  pageNumber: number;
  pageCount: number;
  zoomPercent: number;
  onPageChange: (pageNumber: number) => void;
  onZoomChange: (zoomPercent: number) => void;
};

export default function ReaderFooterBar({ pageNumber, pageCount, zoomPercent, onPageChange, onZoomChange }: Props) {
  const clampedZoom = Math.round(clamp(zoomPercent, 40, 240) * 10) / 10;
  const zoomOptions = [40, 50, 62, 75, 90, 100, 110, 125, 140, 150, 175, 200, 225, 240];
  const normalizedZoomOptions = zoomOptions.includes(clampedZoom) ? zoomOptions : [...zoomOptions, clampedZoom].sort((a, b) => a - b);
  const formatZoomLabel = (value: number) => (Number.isInteger(value) ? `${value},00%` : `${value.toFixed(1).replace(".", ",")}%`);

  return (
    <footer className="reader-footerbar" aria-label="Barra inferior de navegacao">
      <div className="reader-footer-left">
        <button type="button" className="reader-soft-btn reader-footer-btn" onClick={() => onPageChange(1)} disabled={pageNumber <= 1}>
          <ChevronsLeft size={14} strokeWidth={2.1} />
        </button>
        <button type="button" className="reader-soft-btn reader-footer-btn" onClick={() => onPageChange(pageNumber - 1)} disabled={pageNumber <= 1}>
          <ChevronLeft size={14} strokeWidth={2.1} />
        </button>

        <select
          value={pageNumber}
          onChange={(event) => onPageChange(Number(event.target.value))}
          className="reader-footer-page-select"
          aria-label="Selecionar pagina"
        >
          {Array.from({ length: Math.max(1, pageCount) }, (_, index) => {
            const page = index + 1;
            return (
              <option key={`footer-page-${page}`} value={page}>
                {page} / {Math.max(1, pageCount)}
              </option>
            );
          })}
        </select>

        <button type="button" className="reader-soft-btn reader-footer-btn" onClick={() => onPageChange(pageNumber + 1)} disabled={pageNumber >= pageCount}>
          <ChevronRight size={14} strokeWidth={2.1} />
        </button>
        <button type="button" className="reader-soft-btn reader-footer-btn" onClick={() => onPageChange(pageCount)} disabled={pageNumber >= pageCount}>
          <ChevronsRight size={14} strokeWidth={2.1} />
        </button>
      </div>

      <div className="reader-footer-right">
        <button type="button" className="reader-footer-icon-btn" title="Lista">
          <List size={15} strokeWidth={1.9} />
        </button>
        <button type="button" className="reader-footer-icon-btn" title="Duas colunas">
          <Columns2 size={15} strokeWidth={1.9} />
        </button>
        <button type="button" className="reader-footer-icon-btn" title="Grade">
          <LayoutGrid size={15} strokeWidth={1.9} />
        </button>

        <span className="reader-footer-sep" />

        <button type="button" className="reader-footer-icon-btn" onClick={() => onZoomChange(clampedZoom - 1)} aria-label="Reduzir zoom">
          <Minus size={14} strokeWidth={2} />
        </button>
        <input
          type="range"
          min={40}
          max={240}
          step={0.5}
          value={clampedZoom}
          onChange={(event) => onZoomChange(Number(event.target.value))}
          className="reader-footer-zoom-range"
          title={formatZoomLabel(clampedZoom)}
          aria-label="Zoom"
        />
        <button type="button" className="reader-footer-icon-btn" onClick={() => onZoomChange(clampedZoom + 1)} aria-label="Aumentar zoom">
          <Plus size={14} strokeWidth={2} />
        </button>
        <select
          value={clampedZoom}
          onChange={(event) => onZoomChange(Number(event.target.value))}
          className="reader-footer-zoom-select"
          aria-label="Zoom percentual"
        >
          {normalizedZoomOptions.map((value) => (
            <option key={`zoom-${value}`} value={value}>
              {formatZoomLabel(value)}
            </option>
          ))}
        </select>

        <button type="button" className="reader-footer-icon-btn" title="Tela cheia">
          <Expand size={14} strokeWidth={2} />
        </button>
      </div>
    </footer>
  );
}
