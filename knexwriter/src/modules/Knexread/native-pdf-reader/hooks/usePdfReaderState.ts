import { useCallback, useMemo, useState } from "react";
import type {
  PdfReaderSessionRecord,
  PdfReaderSidebarMode,
  PdfReaderViewMode,
} from "../types";

export function usePdfReaderState(initial?: Partial<PdfReaderSessionRecord>) {
  const [currentPage, setCurrentPage] = useState(initial?.currentPage ?? 1);
  const [zoom, setZoom] = useState(initial?.zoom ?? 100);
  const [viewMode, setViewMode] = useState<PdfReaderViewMode>(
    initial?.viewMode ?? "single-page",
  );
  const [sidebarMode, setSidebarMode] = useState<PdfReaderSidebarMode>(
    initial?.sidebarMode ?? "thumbnails",
  );

  const snapshot = useMemo(
    () => ({
      currentPage,
      zoom,
      viewMode,
      sidebarMode,
    }),
    [currentPage, sidebarMode, viewMode, zoom],
  );

  const hydrateFromSession = useCallback((session: PdfReaderSessionRecord | null) => {
    if (!session) return;
    setCurrentPage(session.currentPage || 1);
    setZoom(session.zoom || 100);
    setViewMode(session.viewMode ?? "single-page");
    setSidebarMode(session.sidebarMode ?? "thumbnails");
  }, []);

  return {
    currentPage,
    setCurrentPage,
    zoom,
    setZoom,
    viewMode,
    setViewMode,
    sidebarMode,
    setSidebarMode,
    snapshot,
    hydrateFromSession,
  };
}

