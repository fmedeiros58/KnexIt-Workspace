"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  deleteRecording,
  getRecordingBlob,
  listRecordings,
  saveRecording,
  saveFolder,
  patchRecording,
} from "@/lib/recstore";
import type { DriveRecordingMeta } from "@/types/drive-recording";

type ViewMode = "grid" | "list";
type SortKey = "createdAt" | "name" | "size" | "owner";
type SortDir = "asc" | "desc";
type TypeKey =
  | "all"
  | "folders"
  | "documents"
  | "sheets"
  | "slides"
  | "vids"
  | "gems"
  | "forms"
  | "images"
  | "pdfs"
  | "videos"
  | "archives"
  | "audio"
  | "drawings"
  | "sites"
  | "shortcuts";
type PeopleFilter = { kind: "all" } | { kind: "me" } | { kind: "anyone" } | { kind: "email"; email: string };
type SourceKey = "all" | "gmail" | "meet" | "upconect";
type NavKey =
  | "my"
  | "shared_drives"
  | "computers"
  | "shared"
  | "recent"
  | "starred"
  | "spam"
  | "trash"
  | "storage";

export default function DrivePage() {
  const [items, setItems] = useState<DriveRecordingMeta[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [activeId, setActiveId] = useState<number | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string>("");
  const [q, setQ] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const newWrapRef = useRef<HTMLDivElement | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newMoreOpen, setNewMoreOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeKey>("all");
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [peopleQuery, setPeopleQuery] = useState("");
  const [peopleFilter, setPeopleFilter] = useState<PeopleFilter>({ kind: "all" });
  const [selfEmail, setSelfEmail] = useState<string | null>(null);
  const [modOpen, setModOpen] = useState(false);
  const [modFilter, setModFilter] = useState<ModifiedFilter>({ preset: "all" });
  const [modTmp, setModTmp] = useState<ModifiedFilter>({ preset: "all" });
  const [modFrom, setModFrom] = useState<string>("");
  const [modTo, setModTo] = useState<string>("");
  const [sourceOpen, setSourceOpen] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SourceKey>("all");
  const [navFilter, setNavFilter] = useState<NavKey>("recent");
  const [foldersTop, setFoldersTop] = useState<boolean>(true);
  const [sortOpen, setSortOpen] = useState(false);
  const [rowMenuId, setRowMenuId] = useState<number | null>(null);
  const [rowSub, setRowSub] = useState<"share" | "organize" | null>(null);
  const [rowSubSide, setRowSubSide] = useState<"left" | "right">("left");
  const [shareId, setShareId] = useState<number | null>(null);
  const [playerOverlayOpen, setPlayerOverlayOpen] = useState(false);
  const [playerSize, setPlayerSize] = useState<"expanded" | "mini">("expanded");
  const [appsMenuOpen, setAppsMenuOpen] = useState(false);
  const playerVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const FOLDER_COLORS = [
    "#a57469", "#d94a3a", "#e35d5d", "#f28b1a", "#f6c445",
    "#4c8df6", "#7cc7ff", "#b9e5f4", "#20c997", "#0ea44b", "#9bd47e",
    "#3a3a3a", "#c9c5c5", "#e3d3d3", "#f2b3d1", "#c99cf0", "#9fa9ff"
  ];
  const shareRec = useMemo(() => {
    if (shareId == null) return null;
    return items.find((r) => r.id === shareId) || null;
  }, [items, shareId]);
  // wrappers para controle de clique-fora dos filtros
  const typeWrapRef = useRef<HTMLSpanElement | null>(null);
  const peopleWrapRef = useRef<HTMLSpanElement | null>(null);
  const modWrapRef = useRef<HTMLSpanElement | null>(null);
  const sourceWrapRef = useRef<HTMLSpanElement | null>(null);
  const sortWrapRef = useRef<HTMLSpanElement | null>(null);

  // estilo dos chips de filtro e ação para limpar todos
  const chipCls = (active: boolean) =>
    `inline-flex items-stretch overflow-hidden rounded-lg border text-sm ${
      active
        ? 'bg-sky-100 border-sky-300 text-sky-800'
        : 'bg-white border-slate-300 text-slate-800'
    }`;
  const clearAllFilters = () => {
    setTypeFilter('all');
    setPeopleFilter({ kind: 'all' });
    setModFilter({ preset: 'all' });
    setSourceFilter('all');
    setPeopleOpen(false);
    setTypeOpen(false);
    setModOpen(false);
    setSourceOpen(false);
    setSortOpen(false);
    setRowMenuId(null);
    setRowSub(null);
  };

  const refresh = useCallback(async () => {
    const rows = await listRecordings();
    setItems(rows);
  }, []);

  // Fechar popovers/menus com ESC
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setNewOpen(false);
        setNewMoreOpen(false);
        setTypeOpen(false);
        setPeopleOpen(false);
        setModOpen(false);
        setSourceOpen(false);
        setSortOpen(false);
        setRowMenuId(null);
        setRowSub(null);
        setShareId(null);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Ler preferÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âªncias do usuÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡rio apÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³s hidrataÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o para evitar mismatch SSR/CSR
  useEffect(() => {
    try {
      const v = localStorage.getItem("drive:view") as ViewMode | null;
      if (v) setView(v);
      const sk = localStorage.getItem("drive:sortKey") as SortKey | null;
      if (sk) setSortKey(sk);
      const sd = localStorage.getItem("drive:sortDir") as SortDir | null;
      if (sd) setSortDir(sd);
      const ft = localStorage.getItem("drive:foldersTop");
      if (ft != null) setFoldersTop(ft === "1");
    } catch {}
  }, []);

  // fechar menu "Novo" ao clicar fora
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!newWrapRef.current) return;
      if (!newWrapRef.current.contains(t)) setNewOpen(false);
      // fecha filtros se clicar fora dos seus wrappers
      const activeEl = (typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null);
      const isDateFocusedInsideMod = !!(
        modWrapRef?.current && activeEl && modWrapRef.current.contains(activeEl) &&
        ((activeEl as HTMLInputElement).type === 'date')
      );
      const insideRowMenu = !!((t as HTMLElement).closest && (t as HTMLElement).closest('[data-row-menu="true"]'));
      if (
        !(typeWrapRef?.current && typeWrapRef.current.contains(t)) &&
        !(peopleWrapRef?.current && peopleWrapRef.current.contains(t)) &&
        !(modWrapRef?.current && modWrapRef.current.contains(t)) &&
        !(sourceWrapRef?.current && sourceWrapRef.current.contains(t)) &&
        !(sortWrapRef?.current && sortWrapRef.current.contains(t)) &&
        !insideRowMenu
      ) {
  // não feche enquanto o calendário nativo de <input type="date"> estiver ativo
        if (!isDateFocusedInsideMod) {
          setTypeOpen(false);
          setPeopleOpen(false);
          setModOpen(false);
          setSourceOpen(false);
          setSortOpen(false);
          setRowMenuId(null);
          setRowSub(null);
        }
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // obter email do usuÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡rio (se disponÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­vel) e persistir para saveRecording
  useEffect(() => {
    const fromLS = typeof localStorage !== "undefined" ? localStorage.getItem("drive:selfEmail") : null;
    if (fromLS) setSelfEmail(fromLS);
  supabase.auth.getUser().then(({ data }: any) => {
      const em = data.user?.email ?? null;
      if (em) {
        setSelfEmail(em);
        try { localStorage.setItem("drive:selfEmail", em); } catch {}
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem("drive:view", view);
  }, [view]);
  useEffect(() => {
    localStorage.setItem("drive:sortKey", sortKey);
    localStorage.setItem("drive:sortDir", sortDir);
  }, [sortKey, sortDir]);
  useEffect(() => {
    try { localStorage.setItem("drive:foldersTop", foldersTop ? "1" : "0"); } catch {}
  }, [foldersTop]);

  // Manage preview object URL lifecycle
  useEffect(() => {
    return () => {
      if (previewSrc) URL.revokeObjectURL(previewSrc);
    };
  }, [previewSrc]);

  // Comparador de ordenaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o usado na lista/grade
  const compareRows = useCallback((a: DriveRecordingMeta, b: DriveRecordingMeta) => {
    if (foldersTop) {
      const af = isFolder(a);
      const bf = isFolder(b);
      if (af !== bf) return af ? -1 : 1;
    }
    const mult = sortDir === "asc" ? 1 : -1;
    if (sortKey === "createdAt") return mult * (a.createdAt - b.createdAt);
    if (sortKey === "size") return mult * (a.size - b.size);
    if (sortKey === "owner") return mult * ((a.owner || "").localeCompare(b.owner || ""));
    return mult * (a.name || "").localeCompare(b.name || "");
  }, [sortKey, sortDir, foldersTop]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    // 1) Primeiro, a "pasta" do menu lateral delimita o conjunto base
    let rows = items.filter((r) => matchNav(r, navFilter, selfEmail));
    // 2) Depois, filtros opcionais (apenas se ativados)
    if (typeFilter !== "all") rows = rows.filter((r) => matchType(r, typeFilter));
    if (peopleFilter.kind !== "all") rows = rows.filter((r) => matchPeople(r, peopleFilter, selfEmail));
    if (modFilter.preset !== "all") {
      const range = computeRange(modFilter);
      if (range) {
        const [from, to] = range;
        rows = rows.filter((r) => r.createdAt >= from && r.createdAt <= to);
      }
    }
    if (sourceFilter !== "all") rows = rows.filter((r) => matchSource(r, sourceFilter));
    // 3) Busca por texto (opcional)
    if (term) rows = rows.filter((r) => (r.name || "").toLowerCase().includes(term));
    // 4) OrdenaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o
    rows = rows.sort(compareRows);    return rows;
  }, [items, navFilter, typeFilter, peopleFilter, selfEmail, modFilter, sourceFilter, q, sortKey, sortDir, foldersTop]);
  
  // Ao trocar a "pasta" (menu lateral), limpar filtros secundÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡rios para evitar confusÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o
  useEffect(() => {
    setTypeFilter("all");
    setPeopleFilter({ kind: "all" });
    setModFilter({ preset: "all" });
    setSourceFilter("all");
    setPeopleOpen(false);
    setTypeOpen(false);
    setModOpen(false);
    setSourceOpen(false);
    setSortOpen(false);
    setRowMenuId(null);
    setRowSub(null);
  }, [navFilter]);
  const toggleSelect = (id: number) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const clearSelection = () => setSelected(new Set());
  const selectAll = () => setSelected(new Set(filtered.map((r) => r.id)));

  const openPreview = async (id: number) => {
    const blob = await getRecordingBlob(id);
    const url = URL.createObjectURL(blob);
    if (previewSrc) URL.revokeObjectURL(previewSrc);
    setPreviewSrc(url);
    setActiveId(id);
    setPlayerOverlayOpen(true);
    setPlayerSize("expanded");
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(true);
  };

  useEffect(() => {
    const video = playerVideoRef.current;
    if (!video) return;
    const onTime = () => setCurrentTime(video.currentTime);
    const onMeta = () => setDuration(video.duration || 0);
    const onEnded = () => setIsPlaying(false);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("ended", onEnded);
    video.volume = volume;
    video.playbackRate = speed;
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("ended", onEnded);
    };
  }, [previewSrc, speed, volume]);

  const togglePlay = () => {
    const video = playerVideoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const skip = (value: number) => {
    const video = playerVideoRef.current;
    if (!video) return;
    video.currentTime = Math.min(Math.max(0, video.currentTime + value), duration || video.duration);
  };

  const onTimelineChange = (value: number) => {
    const video = playerVideoRef.current;
    if (!video) return;
    video.currentTime = value;
    setCurrentTime(value);
  };

  const onVolumeChange = (value: number) => {
    setVolume(value);
    if (playerVideoRef.current) playerVideoRef.current.volume = value;
  };

  const onSpeedChange = (value: number) => {
    setSpeed(value);
    if (playerVideoRef.current) playerVideoRef.current.playbackRate = value;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePlayerOverlay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const closePlayerOverlay = () => {
    setPlayerOverlayOpen(false);
  };

  const doDownload = async (ids: number[]) => {
    for (const id of ids) {
      const row = items.find((r) => r.id === id);
      if (!row) continue;
      const blob = await getRecordingBlob(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${row.name || "gravacao"}.webm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
  };

  // AÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o de exclusÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o: move para lixeira por padrÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o; exclui definitivamente quando visualizando a lixeira
  const doDelete = async (ids: number[]) => {
    if (navFilter === 'trash') {
      for (const id of ids) await deleteRecording(id);
    } else {
      for (const id of ids) await patchRecording(id, { trashed: true });
    }
    if (ids.includes(activeId ?? -1)) {
      setActiveId(null);
      setPreviewSrc("");
    }
    await refresh();
    clearSelection();
  };

  const renameRow = async (row: DriveRecordingMeta) => {
    const current = row.name || fallbackName(row);
    const name = (window.prompt('Novo nome', current) || '').trim();
    if (!name || name === (row.name || '')) return;
    try {
      await patchRecording(row.id, { name });
      await refresh();
    } catch (e) {
      console.error('Falha ao renomear', e);
    }
  };

  const restoreFromTrash = async (ids: number[]) => {
    for (const id of ids) await patchRecording(id, { trashed: false });
    await refresh();
    clearSelection();
  };

  const restoreFromSpam = async (ids: number[]) => {
    for (const id of ids) await patchRecording(id, { spam: false });
    await refresh();
    clearSelection();
  };

  // Atualiza estrela imediatamente e persiste em IndexedDB
  const toggleStar = async (id: number, flag: boolean) => {
    setItems((old) => old.map((r) => (r.id === id ? { ...r, starred: flag } : r)));
    try {
      await patchRecording(id, { starred: flag });
    } catch (e) {
      // reverte em caso de erro
      setItems((old) => old.map((r) => (r.id === id ? { ...r, starred: !flag } : r)));
      console.error("Falha ao marcar estrela", e);
    }
  };

  const onImportFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      try {
        await saveRecording(file.name, file);
      } catch (e) {
        console.error("Falha ao salvar arquivo", e);
      }
    }
    await refresh();
  };

  const onImportFolder = async (files: FileList | null) => {
    // semelhante ao upload de arquivos; navegadores expÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âµem webkitRelativePath
    await onImportFiles(files);
  };

  const onCreateFolder = async () => {
    const name = prompt("Nome da pasta:", "Nova pasta");
    if (!name) return;
    try {
      await saveFolder(name);
      // opcional: marcar 'source' como folder
      // nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o temos o id retornado aqui, mas ao listar veremos mime="inode/directory"
      await refresh();
    } catch (e) {
      console.error("Falha ao criar pasta", e);
    }
  };

  const active = items.find((r) => r.id === activeId) || null;
  const posterCacheRef = useRef<Map<number, string>>(new Map());
  const setFolderColor = async (id: number, color: string) => {
    try {
      await patchRecording(id, { color });
      await refresh();
    } catch (e) {
      console.error('Falha ao definir cor da pasta', e);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Top bar estilo Drive */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="px-4 md:px-6 h-16 flex items-center gap-4">
          {/* Marca */}
          <a href="/" className="flex items-center gap-2 no-underline text-slate-900">
            <LogoDrive className="h-6 w-6" />
            <span className="font-medium">Drive</span>
          </a>

          {/* Busca estilo pill com ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­cone de filtro ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â  direita */}
          <div className="flex-1">
            <div className="rounded-full bg-slate-100 ring-1 ring-slate-200 flex items-center h-11 px-3">
              <IconSearch className="h-4 w-4 text-slate-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Pesquise no Drive"
                className="bg-transparent outline-none text-sm px-3 w-full"
              />
              <button className="inline-flex items-center justify-center h-8 w-8 rounded-full hover:bg-slate-200" title="Filtros">
                <IconTune className="h-4 w-4 text-slate-600" />
              </button>
            </div>
          </div>

          {/* AÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âµes do topo ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â  direita */}
          <div className="hidden md:flex items-center gap-2">
            <button className="h-9 w-9 rounded-full hover:bg-slate-100 grid place-items-center" title="SeleÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o">
              <IconCheckCircle className="h-5 w-5 text-slate-700" />
            </button>
            <button className="h-9 w-9 rounded-full hover:bg-slate-100 grid place-items-center" title="Ajuda">
              <IconHelp className="h-5 w-5 text-slate-700" />
            </button>
            <button className="h-9 w-9 rounded-full hover:bg-slate-100 grid place-items-center" title="ConfiguraÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âµes">
              <IconGear className="h-5 w-5 text-slate-700" />
            </button>
            <button className="h-9 w-9 rounded-full hover:bg-slate-100 grid place-items-center" title="Destacar">
              <IconStar className="h-5 w-5 text-slate-700" />
            </button>
            <button className="h-9 w-9 rounded-full hover:bg-slate-100 grid place-items-center" title="Apps">
              <IconDotsGrid className="h-5 w-5 text-slate-700" />
            </button>
            <div className="h-9 w-9 rounded-full bg-slate-200 grid place-items-center text-sm font-medium text-slate-800" title="Conta">
              U
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 md:px-6 py-4 grid gap-6 grid-cols-[280px_1fr]">
        {/* Sidebar esquerda */}
        <aside className="min-w-0">
          <div className="sticky top-[4.5rem] space-y-3">
            <div className="relative" ref={newWrapRef}>
              <button
                className="inline-flex items-center gap-2 rounded-full bg-indigo-600 text-white px-4 py-2 text-sm shadow hover:bg-indigo-700"
                onClick={(e) => { e.stopPropagation(); setNewOpen((s) => !s); }}
              >
                <IconPlus className="h-4 w-4" />
                Novo
              </button>
              {/* Hidden inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*,audio/*"
                multiple
                className="hidden"
                onChange={(e) => { setNewOpen(false); onImportFiles(e.target.files); e.currentTarget.value = ""; }}
              />
              {/* @ts-ignore */}
              <input
                ref={folderInputRef}
                type="file"
                multiple
                className="hidden"
                // @ts-ignore
                webkitdirectory="true"
                onChange={(e) => { setNewOpen(false); onImportFolder(e.target.files); e.currentTarget.value = ""; }}
              />

              {newOpen && (
                <div className="absolute z-50 mt-2 w-72 rounded-xl bg-white ring-1 ring-slate-200 shadow-2xl overflow-visible">
                  <div className="py-1">
                    <MenuItem icon={<IconFolder className="h-4 w-4" />} label="Nova pasta" onClick={onCreateFolder} shortcut="Alt+C, depois F" />
                    <MenuItem icon={<IconUpload className="h-4 w-4" />} label="Upload de arquivo" onClick={() => fileInputRef.current?.click()} shortcut="Alt+C, depois U" />
                    <MenuItem icon={<IconUpload className="h-4 w-4" />} label="Upload de pasta" onClick={() => folderInputRef.current?.click()} shortcut="Alt+C, depois I" />
                  </div>
                  <div className="border-t border-slate-200" />
                  <div className="py-1">
                    <MenuItem icon={<span className="inline-grid h-5 w-5 place-items-center rounded-sm bg-[#4285F4] text-white"><IconDoc className="h-3.5 w-3.5" /></span>} label="Documentos Google" onClick={() => window.open('https://docs.new','_blank')} chevron />
                    <MenuItem icon={<span className="inline-grid h-5 w-5 place-items-center rounded-sm bg-[#34A853] text-white"><IconSheet className="h-3.5 w-3.5" /></span>} label="Planilhas Google" onClick={() => window.open('https://sheets.new','_blank')} chevron />
                    <MenuItem icon={<span className="inline-grid h-5 w-5 place-items-center rounded-sm bg-[#FBBC05] text-white"><IconSlides className="h-3.5 w-3.5" /></span>} label="Apresentações Google" onClick={() => window.open('https://slides.new','_blank')} chevron />
                    <MenuItem icon={<IconPlay className="h-4 w-4" />} label="Google Vids" onClick={() => window.open('https://vids.new','_blank')} chevron />
                    <MenuItem icon={<span className="inline-grid h-5 w-5 place-items-center rounded-sm bg-[#8E24AA] text-white"><IconForm className="h-3.5 w-3.5" /></span>} label="Formulários Google" onClick={() => window.open('https://forms.new','_blank')} chevron />
                    <div className="relative" onMouseEnter={() => setNewMoreOpen(true)} onMouseLeave={() => setNewMoreOpen(false)}>
                      <MenuItem icon={<IconDotsGrid className="h-4 w-4" />} label="Mais" onClick={() => setNewMoreOpen((s)=>!s)} chevron />
                      {newMoreOpen && (
                        <div className="absolute left-full top-0 ml-1 w-72 rounded-xl bg-white ring-1 ring-slate-200 shadow-2xl overflow-hidden">
                          <div className="py-1">
                            <MenuItem icon={<IconBrush className="h-4 w-4" />} label="Desenhos Google" onClick={() => window.open('https://drawings.google.com','_blank')} />
                            <MenuItem icon={<IconMapPin className="h-4 w-4" />} label="Google My Maps" onClick={() => window.open('https://mymaps.google.com','_blank')} />
                            <MenuItem icon={<IconGlobe className="h-4 w-4" />} label="Google Sites" onClick={() => window.open('https://sites.google.com/new','_blank')} />
                            <MenuItem icon={<IconLink className="h-4 w-4" />} label="Copy, URL to Google Drive" onClick={() => window.open('https://drive.google.com','_blank')} />
                            <MenuItem icon={<IconScript className="h-4 w-4" />} label="Script do Google Apps" onClick={() => window.open('https://script.google.com/home/start','_blank')} />
                          </div>
                          <div className="border-t border-slate-200" />
                          <div className="py-1">
                            <MenuItem icon={<IconPlus className="h-4 w-4" />} label="Conectar mais apps" onClick={() => window.open('https://workspace.google.com/marketplace','_blank')} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <SidebarNav selfEmail={selfEmail} active={navFilter} onFilter={(f) => setNavFilter(f)} />
          </div>
        </aside>

        {/* ConteÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºdo principal */}
        <section className="min-w-0">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-slate-900">Meu Drive</h1>
                <IconChevronDown className="h-4 w-4 text-slate-500" />
              </div>
              {/* Chips de filtro */}
              <div className="mt-2 flex flex-wrap items-center gap-2 relative">
                <span ref={typeWrapRef} className="relative inline-flex items-stretch">
                  <span className={chipCls(typeFilter !== 'all')}>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 px-3 py-1.5"
                      onClick={(e) => { e.stopPropagation(); const next = !typeOpen; setPeopleOpen(false); setModOpen(false); setSourceOpen(false); setTypeOpen(next); }}
                    >
                      {typeFilter === "all" ? "Tipo" : `Tipo: ${TYPE_OPTIONS.find(o=>o.key===typeFilter)?.label ?? ""}`}
                      <IconChevronDown className="h-3.5 w-3.5 text-slate-500" />
                    </button>
                    {typeFilter !== 'all' && (
                      <button
                        type="button"
                        aria-label="Limpar filtro de modificação"
                        className="px-2 py-1.5 border-l border-sky-300 text-sky-700 hover:text-sky-900"
                        onClick={(e) => { e.stopPropagation(); setTypeFilter('all'); setTypeOpen(false); }}
                      >
                        <IconX className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </span>
                  {typeOpen && (
                    <div className="absolute z-50 top-[44px] left-0 w-64 rounded-xl bg-white ring-1 ring-slate-200 shadow-2xl p-1">
                      {TYPE_OPTIONS.map((opt) => (
                        <button
                          key={opt.key}
                          className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-slate-100 text-sm ${
                            typeFilter === opt.key ? "bg-slate-100" : ""
                          }`}
                          onClick={() => {
                            setTypeFilter(opt.key);
                            setTypeOpen(false);
                          }}
                        >
                          {opt.icon({ className: "h-5 w-5" })}
                          <span className="truncate">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </span>

                <span ref={peopleWrapRef} className="relative inline-flex items-stretch">
                  <span className={chipCls(peopleFilter.kind !== 'all')}>
                    <button
                    type="button"
                    className="inline-flex items-center gap-1 px-3 py-1.5"
                    onClick={(e) => { e.stopPropagation(); const next = !peopleOpen; setTypeOpen(false); setModOpen(false); setSourceOpen(false); setPeopleOpen(next); }}
                  >
                    {peopleFilter.kind === "all"
                      ? "Pessoas"
                      : peopleFilter.kind === "me"
                      ? "Pessoas: Você"
                      : peopleFilter.kind === "anyone"
                      ? "Pessoas: Qualquer um"
                      : `Pessoas: ${peopleFilter.email}`}
                    <IconChevronDown className="h-3.5 w-3.5 text-slate-500" />
                  </button>
                  {peopleFilter.kind !== 'all' && (
                    <button
                      type="button"
                      aria-label="Limpar filtro de modificação"
                      className="px-2 py-1.5 border-l border-sky-300 text-sky-700 hover:text-sky-900"
                      onClick={(e) => { e.stopPropagation(); setPeopleFilter({ kind: 'all' }); setPeopleOpen(false); }}
                    >
                      <IconX className="h-3.5 w-3.5" />
                    </button>
                  )}
                  </span>
                  {peopleOpen && (
                    <PeopleMenu
                      query={peopleQuery}
                      onQuery={setPeopleQuery}
                      onClose={() => setPeopleOpen(false)}
                      onSelect={(pf) => { setPeopleFilter(pf); setPeopleOpen(false); }}
                      items={items}
                      selfEmail={selfEmail}
                    />
                  )}
                </span>
                <span ref={modWrapRef} className="relative inline-flex items-stretch">
                  <span className={chipCls(modFilter.preset !== 'all')}>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 px-3 py-1.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      setModTmp(modFilter);
                      if (modFilter.preset === "custom") {
                        setModFrom(dateInputValue(modFilter.from));
                        setModTo(dateInputValue(modFilter.to));
                      } else {
                        setModFrom("");
                        setModTo("");
                      }
                      const next = !modOpen;
                      setTypeOpen(false);
                      setPeopleOpen(false);
                      setModOpen(next);
                    }}
                  >
                    {modFilter.preset === "all"
                      ? "Modificado"
                      : `Modificado: ${formatModifiedLabel(modFilter)}`}
                    <IconChevronDown className="h-3.5 w-3.5 text-slate-500" />
                  </button>
                  {modFilter.preset !== 'all' && (
                    <button
                      type="button"
                      aria-label="Limpar filtro de modificação"
                      className="px-2 py-1.5 border-l border-sky-300 text-sky-700 hover:text-sky-900"
                      onClick={(e) => { e.stopPropagation(); setModFilter({ preset: 'all' }); setModOpen(false); }}
                    >
                      <IconX className="h-3.5 w-3.5" />
                    </button>
                  )}
                  </span>
                  {modOpen && (
                    <ModifiedMenu
                      tmp={modTmp}
                      onTmpChange={setModTmp}
                      from={modFrom}
                      to={modTo}
                      onFrom={setModFrom}
                      onTo={setModTo}
                      onQuick={(f) => { setModFilter(f); setModOpen(false); }}
                      onApply={() => {
                        let next = modTmp;
                        if (next.preset === "custom") {
                          const f = parseDateInput(modFrom);
                          const tParsed = parseDateInput(modTo);
                          if (f != null && tParsed != null) {
                            const t = endOfDay(tParsed);
                            next = { preset: "custom", from: f, to: t };
                          }
                        }
                        setModFilter(next);
                        setModOpen(false);
                      }}
                      onCancel={() => { setModOpen(false); }}
                      onClear={() => { setModFilter({ preset: "all" }); setModOpen(false); }}
                    />
                  )}
                </span>
                <span ref={sourceWrapRef} className="relative inline-flex items-stretch">
                  <span className={chipCls(sourceFilter !== 'all')}>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 px-3 py-1.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        const next = !sourceOpen;
                        setTypeOpen(false);
                        setPeopleOpen(false);
                        setModOpen(false);
                        setSourceOpen(next);
                      }}
                    >
                      {sourceFilter === "all" ? "Fonte" : `Fonte: ${sourceFilter === 'gmail' ? 'Gmail' : sourceFilter === 'meet' ? 'Meet' : 'UpConect'}`}
                      <IconChevronDown className="h-3.5 w-3.5 text-slate-500" />
                    </button>
                    {sourceFilter !== 'all' && (
                      <button
                        type="button"
                        aria-label="Limpar filtro de modificação"
                        className="px-2 py-1.5 border-l border-sky-300 text-sky-700 hover:text-sky-900"
                        onClick={(e) => { e.stopPropagation(); setSourceFilter('all'); setSourceOpen(false); }}
                      >
                        <IconX className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </span>
                  {sourceOpen && (
                    <div className="absolute z-50 top-[44px] left-0 w-60 rounded-xl bg-white ring-1 ring-slate-200 shadow-2xl p-1">
                      <button className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-slate-100 text-sm ${sourceFilter==='gmail'?'bg-slate-100':''}`} onClick={() => { setSourceFilter('gmail'); setSourceOpen(false); }}>
                        <IconGmail className="h-5 w-5" />
                        <span>Gmail</span>
                      </button>
                      <button className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-slate-100 text-sm ${sourceFilter==='meet'?'bg-slate-100':''}`} onClick={() => { setSourceFilter('meet'); setSourceOpen(false); }}>
                        <IconMeet className="h-5 w-5" />
                        <span>Meet</span>
                      </button>
                      <button className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-slate-100 text-sm ${sourceFilter==='upconect'?'bg-slate-100':''}`} onClick={() => { setSourceFilter('upconect'); setSourceOpen(false); }}>
                        <IconUpConect className="h-5 w-5" />
                        <span>UpConect</span>
                      </button>
                    </div>
                  )}
                </span>
                <button
                  type="button"
                  className="text-sm text-slate-600 px-2 py-1 rounded-lg border border-transparent hover:bg-slate-100 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  onClick={clearAllFilters}
                >
                  Limpar filtros
                </button>
              </div>
            </div>
            {/* Grupo de visualizaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o e info ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â  direita */}
              <div className="shrink-0 flex items-center gap-2">
                <div className="inline-flex items-center rounded-full ring-1 ring-slate-300 bg-white overflow-hidden">
                  <span className={`px-2 py-1.5 text-sm ${selected.size > 0 ? "text-indigo-700" : "text-slate-500"}`}>
                    <IconCheck className="h-4 w-4" />
                  </span>
                  <button
                    className={`px-3 py-1.5 text-sm ${view === "list" ? "bg-slate-100" : ""}`}
                    onClick={() => setView("list")}
                    title="Lista"
                  >
                    <IconList className="h-4 w-4" />
                  </button>
                  <button
                    className={`px-3 py-1.5 text-sm ${view === "grid" ? "bg-slate-100" : ""}`}
                    onClick={() => setView("grid")}
                    title="Grade"
                  >
                    <IconGrid className="h-4 w-4" />
                  </button>
                </div>
              </div>
          </div>
          {/* Barra de aÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âµes quando hÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ seleÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o */}
          {selected.size > 0 && (
            <div className="mb-3 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <span className="text-slate-700">{selected.size} selecionado(s)</span>
              <div className="flex-1" />
              {navFilter === 'trash' ? (
                <>
                  <button className="px-2 py-1.5 rounded hover:bg-slate-100" onClick={() => restoreFromTrash(Array.from(selected))}>Restaurar</button>
                  <button className="px-2 py-1.5 rounded hover:bg-slate-100 text-rose-600" onClick={() => doDelete(Array.from(selected))}>Excluir definitivamente</button>
                </>
              ) : navFilter === 'spam' ? (
                <>
                  <button className="px-2 py-1.5 rounded hover:bg-slate-100" onClick={() => restoreFromSpam(Array.from(selected))}>Remover spam</button>
                  <button className="px-2 py-1.5 rounded hover:bg-slate-100" onClick={() => doDelete(Array.from(selected))}>Mover p/ lixeira</button>
                </>
              ) : (
                <>
                  <button className="px-2 py-1.5 rounded hover:bg-slate-100" onClick={() => doDownload(Array.from(selected))}>Baixar</button>
                  <button className="px-2 py-1.5 rounded hover:bg-slate-100" onClick={() => doDelete(Array.from(selected))}>Mover p/ lixeira</button>
                </>
              )}
              <button className="px-2 py-1.5 rounded hover:bg-slate-100" onClick={clearSelection}>Limpar</button>
            </div>
          )}

          {/* Lista ou Grade */}
          {filtered.length === 0 ? (
            <EmptyState onImport={() => fileInputRef.current?.click()} />
          ) : view === "grid" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((r) => (
                <FileCard
                  key={r.id}
                  meta={r}
                  selected={selected.has(r.id)}
                  onToggleSelect={() => toggleSelect(r.id)}
                  onOpen={() => openPreview(r.id)}
                  onDownload={() => doDownload([r.id])}
                  onDelete={() => doDelete([r.id])}
                  onStar={(flag) => toggleStar(r.id, flag)}
                  onTrash={async () => { await patchRecording(r.id, { trashed: true }); await refresh(); }}
                  onSpam={async (flag) => { await patchRecording(r.id, { spam: flag }); await refresh(); }}
                  posterCache={posterCacheRef.current}
                  active={activeId === r.id}
                  currentNav={navFilter}
                  onRestore={
                    navFilter === 'trash' ? (async () => { await patchRecording(r.id, { trashed: false }); await refresh(); }) :
                    navFilter === 'spam' ? (async () => { await patchRecording(r.id, { spam: false }); await refresh(); }) :
                    undefined
                  }
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 text-slate-600 text-xs px-3 py-2 grid grid-cols-[minmax(0,1fr)_180px_180px_120px_220px]">
                <div className="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    aria-label="Selecionar todos"
                    onChange={(e) => (e.target.checked ? selectAll() : clearSelection())}
                  />
                  <button
                    className="inline-flex items-center gap-1 hover:text-slate-800"
                    onClick={() => { setSortKey('name'); setSortDir((d) => (sortKey === 'name' ? (d === 'asc' ? 'desc' : 'asc') : 'asc')); }}
                    title="Ordenar por nome"
                  >
                    <span>Nome</span>
                    <span>{sortKey === 'name' ? (sortDir === 'asc' ? 'A-Z' : 'Z-A') : ''}</span>
                  </button>
                </div>
                <div className="flex items-center justify-end">Proprietário</div>
                <div className="flex items-center justify-end">Data da modificação</div>
                <div className="flex items-center justify-end">Tamanho</div>

                <span ref={sortWrapRef} className="relative flex items-center justify-end">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 px-2 py-1 rounded-md hover:bg-slate-100 text-slate-600"
                    onClick={(e) => { e.stopPropagation(); setSortOpen((s) => !s); }}
                  >
                    <IconSort className="h-4 w-4" />
                    <span>Classificar</span>
                  </button>

                  {sortOpen && (
                    <div className="absolute z-50 top-[28px] right-0 w-64 rounded-xl bg-white ring-1 ring-slate-200 shadow-2xl text-sm">
                      <div className="px-3 py-2 text-[11px] text-slate-500">Ordenar por</div>
                      <button className={`w-full text-left px-3 py-2 hover:bg-slate-100 ${sortKey==='name'?'bg-slate-100':''}`}
                              onClick={() => { setSortKey('name'); setSortOpen(false); }}>Nome</button>
                      <button className={`w-full text-left px-3 py-2 hover:bg-slate-100 ${sortKey==='createdAt'?'bg-slate-100':''}`}
                              onClick={() => { setSortKey('createdAt'); setSortOpen(false); }}>Data da modificação</button>
                      <button className={`w-full text-left px-3 py-2 hover:bg-slate-100 ${sortKey==='owner'?'bg-slate-100':''}`}
                              onClick={() => { setSortKey('owner'); setSortOpen(false); }}>Proprietário</button>
                      <button className={`w-full text-left px-3 py-2 hover:bg-slate-100 ${sortKey==='size'?'bg-slate-100':''}`}
                              onClick={() => { setSortKey('size'); setSortOpen(false); }}>Tamanho</button>

                      <div className="my-1 border-t border-slate-200" />
                      <div className="px-3 py-2 text-[11px] text-slate-500">Direção de classificação</div>
                      <button className={`w-full text-left px-3 py-2 hover:bg-slate-100 ${sortDir==='asc'?'bg-slate-100':''}`}
                              onClick={() => { setSortDir('asc'); setSortOpen(false); }}>A a Z</button>
                      <button className={`w-full text-left px-3 py-2 hover:bg-slate-100 ${sortDir==='desc'?'bg-slate-100':''}`}
                              onClick={() => { setSortDir('desc'); setSortOpen(false); }}>Z a A</button>

                      <div className="my-1 border-t border-slate-200" />
                      <div className="px-3 py-2 text-[11px] text-slate-500">Pastas</div>
                      <button className={`w-full text-left px-3 py-2 hover:bg-slate-100 ${foldersTop?'bg-slate-100':''}`}
                              onClick={() => { setFoldersTop(true); setSortOpen(false); }}>Acima</button>
                      <button className={`w-full text-left px-3 py-2 hover:bg-slate-100 ${!foldersTop?'bg-slate-100':''}`}
                              onClick={() => { setFoldersTop(false); setSortOpen(false); }}>Misturado com arquivos</button>
                    </div>
                  )}
                </span>
              </div>
              <ul className="divide-y divide-slate-200">
                {filtered.map((r) => (
                  <li
                    key={r.id}
                    className={`group grid grid-cols-[minmax(0,1fr)_180px_180px_120px_220px] items-center px-3 py-2 hover:bg-sky-100 ${
                      activeId === r.id ? "bg-indigo-50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                      <input className="shrink-0" type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} />
                      <button className="flex items-center gap-2 text-left flex-1 min-w-0" onClick={() => { if (!isFolder(r)) openPreview(r.id); }}>
                        {isFolder(r) ? <IconFolder className="h-5 w-5 shrink-0" style={{ color: (r as any).color || '#64748b' }} /> : <FileThumb className="h-5 w-5 shrink-0" />}
                        <span className="truncate max-w-full" title={r.name || fallbackName(r)}>{r.name || fallbackName(r)}</span>
                      </button>
                    </div>
                    <div className="text-sm text-slate-600 text-right truncate" title={r.owner || ''}>{r.owner || ''}</div>
                    <div className="text-sm text-slate-600 text-right">{fmtDate(r.createdAt)}</div>
                    <div className="text-sm text-slate-600 text-right">{isFolder(r) ? '-' : fmtSize(r.size)}</div>
                    <div className="relative flex items-center justify-end gap-1" data-row-menu="true">
                      <div className="hidden group-hover:flex items-center gap-2 text-slate-600">
                        <button className="h-8 w-8 grid place-items-center rounded hover:bg-slate-100" title="Compartilhar" onClick={(e) => { e.stopPropagation(); setRowMenuId(null); setShareId(r.id); }}>
                          <IconUsers className="h-4 w-4" />
                        </button>
                        <button className="h-8 w-8 grid place-items-center rounded hover:bg-slate-100" title="Baixar" onClick={(e) => { e.stopPropagation(); doDownload([r.id]); setRowMenuId(null); }}>
                          <IconDownload className="h-4 w-4" />
                        </button>
                        <button className="h-8 w-8 grid place-items-center rounded hover:bg-slate-100" title="Renomear" onClick={(e) => { e.stopPropagation(); renameRow(r); setRowMenuId(null); }}>
                          <IconPencil className="h-4 w-4" />
                        </button>
                        <button className="h-8 w-8 grid place-items-center rounded hover:bg-slate-100" title={r.starred ? 'Remover estrela' : 'Adicionar estrela'} onClick={() => toggleStar(r.id, !r.starred)}>
                          <IconStar className={`h-4 w-4 ${r.starred ? 'text-amber-500' : ''}`} />
                        </button>
                        <button className="h-8 w-8 grid place-items-center rounded hover:bg-slate-100" title="Mais aÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âµes" onClick={(e) => { e.stopPropagation(); setRowMenuId(rowMenuId === r.id ? null : r.id); }}>
                          <IconMoreVert className="h-4 w-4" />
                        </button>
                      </div>
                      <button className="group-hover:hidden h-8 w-8 grid place-items-center rounded hover:bg-slate-100 text-slate-600" title="Mais aÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âµes" onClick={(e) => { e.stopPropagation(); setRowMenuId(rowMenuId === r.id ? null : r.id); }}>
                        <IconMoreVert className="h-4 w-4" />
                      </button>
                      {rowMenuId === r.id && (
                        <div className="absolute z-50 top-8 right-0 w-64 rounded-xl bg-white ring-1 ring-slate-200 shadow-2xl text-sm" data-row-flyout-root="true" onClick={(e) => e.stopPropagation()}>
                          <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-100" onClick={() => { doDownload([r.id]); setRowMenuId(null); }}>
                            <IconDownload className="h-4 w-4" />
                            <span>Baixar</span>
                          </button>
                          {rowSub === 'organize' && (
                            <div className={`absolute top-0 ${rowSubSide === 'right' ? 'left-full ml-2' : 'right-full mr-2'} w-72 rounded-xl bg-white ring-1 ring-slate-200 shadow-2xl text-sm p-2`} onClick={(e) => e.stopPropagation()}>
                              <button className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-slate-100" onClick={() => { /* TODO: mover */ }}>
                                <IconFolder className="h-4 w-4" />
                                <span>Mover</span>
                                <span className="ml-auto text-[11px] text-slate-500">Ctrl+Alt+M</span>
                              </button>
                              <button className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-slate-100" onClick={() => { /* TODO: atalho */ }}>
                                <IconShortcut className="h-4 w-4" />
                                <span>Adicionar atalho</span>
                                <span className="ml-auto text-[11px] text-slate-500">Ctrl+Alt+R</span>
                              </button>
                              <button className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-slate-100" onClick={() => { toggleStar(r.id, !r.starred); }}>
                                <IconStar className="h-4 w-4" />
                                <span>{r.starred ? 'Remover de "Com estrela"' : 'Adicionar a "Com estrela"'}</span>
                                <span className="ml-auto text-[11px] text-slate-500">Ctrl+Alt+S</span>
                              </button>
                              {isFolder(r) && (
                                <div className="mt-2">
                                  <div className="px-3 py-2 text-xs text-slate-600">Cor da pasta</div>
                                  <div className="grid grid-cols-8 gap-2 px-3 pb-2">
                                    {FOLDER_COLORS.map((c) => (
                                      <button
                                        key={c}
                                        className="h-6 w-6 rounded-full border border-slate-300"
                                        style={{ backgroundColor: c }}
                                        title={c}
                                        onClick={() => { setFolderColor(r.id, c); setRowMenuId(null); setRowSub(null); }}
                                      >
                                        {(r as any).color === c ? (
                                          <span className="block h-full w-full rounded-full ring-2 ring-white"></span>
                                        ) : null}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-100" onClick={() => { renameRow(r); setRowMenuId(null); }}>
                            <IconPencil className="h-4 w-4" />
                            <span>Renomear</span>
                            <span className="ml-auto text-[11px] text-slate-500">Ctrl+Alt+E</span>
                          </button>
                          <div className="my-1 border-t border-slate-200" />
                          <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-100" onClick={() => { setShareId(r.id); setRowMenuId(null); }}>
                            <IconUsers className="h-4 w-4" />
                            <span>Compartilhar</span>
                            <span className="ml-auto text-slate-400">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âº</span>
                          </button>
                          <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-100" onClick={(e) => { e.stopPropagation(); const root = (e.currentTarget.closest('[data-row-flyout-root="true"]') as HTMLElement | null); if (root) { const rect = root.getBoundingClientRect(); const vw = window.innerWidth || document.documentElement.clientWidth || 0; const SUB_W = 288; const GAP = 8; const fitsRight = rect.right + GAP + SUB_W <= vw; setRowSubSide(fitsRight ? 'right' : 'left'); } setRowSub(rowSub === 'organize' && rowMenuId === r.id ? null : 'organize'); }}>
                            <IconFolder className="h-4 w-4" />
                            <span>Organizar</span>
                            <span className="ml-auto text-slate-400">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âº</span>
                          </button>
                          <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-100" onClick={() => { setActiveId(r.id); setRowMenuId(null); }}>
                            <IconInfo className="h-4 w-4" />
                            <span>InformaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âµes da pasta</span>
                          </button>
                          <div className="my-1 border-t border-slate-200" />
                          <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-100 text-red-700" onClick={() => { doDelete([r.id]); setRowMenuId(null); }}>
                            <IconTrash className="h-4 w-4" />
                            <span>Mover para a lixeira</span>
                            <span className="ml-auto text-[11px]">Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Painel de detalhes / PrÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©-visualizaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o */}
        

        {shareId != null && (
          <div className="fixed inset-0 z-[60] bg-black/30 flex items-center justify-center" onClick={() => setShareId(null)}>
            <div className="w-[520px] max-w-[90vw] rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between p-5 pb-3">
                <div>
                  <div className="text-xl font-semibold leading-snug">
                    Compartilhar {`"${(shareRec?.name && shareRec.name.trim().length > 0 ? shareRec.name : 'Arquivo')}"`}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-slate-500">
                  <button className="h-8 w-8 grid place-items-center rounded hover:bg-slate-100" title="Ajuda">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ</button>
                  <button className="h-8 w-8 grid place-items-center rounded hover:bg-slate-100" title="Configuracoes">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢</button>
                  <button className="h-8 w-8 grid place-items-center rounded hover:bg-slate-100" title="Fechar" onClick={() => setShareId(null)}>ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢</button>
                </div>
              </div>
              <div className="px-5 pb-5">
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Adicionar participantes, grupos, espaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§os e eventos da agenda"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="mb-6">
                  <div className="text-sm font-medium mb-2">Pessoas com acesso</div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-slate-200" />
                      <div>
                        <div className="text-sm font-medium">VocÃƒÂª</div>
                        <div className="text-xs text-slate-600">{shareRec?.owner || ''}</div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">ProprietÃƒÂ¡rio</div>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="text-sm font-medium mb-2">Acesso geral</div>
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center gap-2 text-slate-700">
                      <span className="text-lg">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢</span>
                      <span className="text-sm">Restrito</span>
                    </div>
                    <button className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">
                      Alterar
                      <span className="text-slate-500">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¾</span>
                    </button>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">So as pessoas com acesso podem abrir usando o link.</div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <button
                    className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
                    onClick={async () => {
                      const href = (typeof location !== 'undefined' ? `${location.origin}` : '') + `/upconect/drive/share/${shareId}`;
                      try { await navigator.clipboard.writeText(href); alert('Link copiado'); } catch {}
                    }}
                  >
                    <span className="text-base">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â</span>
                    Copiar link
                  </button>
                  <button
                    className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    onClick={() => setShareId(null)}
                  >
                    Concluido
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      {playerOverlayOpen && previewSrc && (
        <div
          className={`fixed inset-0 z-[70] flex ${
            playerSize === "mini" ? "items-end justify-end p-4" : "items-center justify-center p-6"
          } bg-black/60 backdrop-blur-sm`}
          role="dialog"
          aria-modal="true"
          aria-label={active?.name ? `${active.name} — Player` : "Player de gravações"}
        >
          <div className="absolute inset-x-0 top-6 flex items-center justify-between border-b border-white/10 bg-slate-950/80 px-6 py-2 text-white text-xs shadow-xl backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <button className="text-lg leading-none" aria-label="Fechar player" onClick={closePlayerOverlay}>
                ×
              </button>
              <span className="text-sm font-medium truncate max-w-[220px]" title={active?.name || "Gravação"}>
                {active?.name || "Gravação"}
              </span>
            </div>
            <div className="relative flex items-center justify-center">
              <button
                className="px-5 py-1 rounded-full border border-white/30 bg-slate-900 hover:bg-slate-800"
                onClick={() => setAppsMenuOpen((prev) => !prev)}
                aria-label="Abrir com"
              >
                Abrir com ▾
              </button>
              {appsMenuOpen && (
                <div className="absolute left-1/2 top-full z-50 -translate-x-1/2 mt-2 w-56 rounded-xl bg-slate-900 border border-white/10 shadow-2xl">
                  <div className="px-4 py-2 text-sm font-semibold border-b border-white/10">Aplicativos conectados</div>
                  <button className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-white/5">
                    ☁ CloudConvert
                  </button>
                  <button className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-white/5">
                    📄 Copy, URL to Google Drive
                  </button>
                  <button className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-white/5">
                    ▶ Google Vids
                  </button>
                  <button className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-white/5">
                    + Conectar mais aplicativos
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 border border-white/20 rounded-full">+</span>
              <span className="px-2 py-1 border border-white/20 rounded-full">⇩</span>
              <span className="px-2 py-1 border border-white/20 rounded-full">?</span>
              <button className="px-4 py-1 rounded-full bg-blue-600 text-white flex items-center gap-2">
                <span>🔒</span> Compartilhar ▾
              </button>
            </div>
          </div>
          <div
            className={`w-full ${
              playerSize === "mini"
                ? "max-w-[420px] min-h-[320px]"
                : "max-w-[1024px] min-h-[520px] h-[min(90vh,660px)]"
            } bg-white shadow flex flex-col overflow-hidden mt-12`}
          >
            <div className="flex flex-col flex-1 bg-slate-950 text-white text-xs">
              <div className="relative flex-1 bg-black flex items-center justify-center group">
                <video
                  ref={playerVideoRef}
                  src={previewSrc}
                  className="h-full w-full object-contain bg-black"
                  autoPlay
                  playsInline
                />
                <div className="absolute inset-0 flex flex-col justify-end px-3 pb-3 pointer-events-none opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <div className="w-full pointer-events-auto space-y-2">
                    <input
                      type="range"
                      min={0}
                      max={duration || 0}
                      value={currentTime}
                      onChange={(e) => onTimelineChange(Number(e.target.value))}
                      className="w-full h-1 accent-white"
                      style={{ backgroundColor: "rgba(255,255,255,0.4)" }}
                    />
                    <div className="flex items-center justify-between text-xs text-white/80">
                      <span>{new Date(currentTime * 1000).toISOString().substr(14, 5)}</span>
                      <span>{new Date((duration || 0) * 1000).toISOString().substr(14, 5)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={togglePlay}
                          className="h-12 px-6 rounded-full bg-white text-black flex items-center justify-center shadow-lg"
                          aria-label={isPlaying ? "Pausar" : "Reproduzir"}
                        >
                          {isPlaying ? "❚❚" : "▶"}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 bg-black/70 rounded-full px-3 py-1 text-white text-xs">
                        <button onClick={() => skip(-10)} aria-label="Voltar 10 segundos" className="text-lg">
                          ↺
                        </button>
                        <button onClick={() => skip(10)} aria-label="Avançar 10 segundos" className="text-lg">
                          ↻
                        </button>
                        <span>
                          {new Date(currentTime * 1000).toISOString().substr(14, 5)} / {new Date((duration || 0) * 1000).toISOString().substr(14, 5)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="p-1 text-white/80 hover:text-white" aria-label="Volume">
                          🔉
                        </button>
                        <button className="p-1 text-white/80 hover:text-white" aria-label="Legendas">
                          CC
                        </button>
                        <button className="p-1 text-white/80 hover:text-white" aria-label="Velocidade">
                          {speed}x
                        </button>
                        <button className="p-1 text-white/80 hover:text-white" aria-label="Configurações">
                          ⚙
                        </button>
                        <button
                          className="p-1 text-white/80 hover:text-white"
                          aria-label="Tela cheia"
                          onClick={() => {
                            const video = playerVideoRef.current;
                            if (video && video.requestFullscreen) video.requestFullscreen();
                          }}
                        >
                          ⛶
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ====== Componentes auxiliares ====== */
function ChipButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
    >
      {children}
      <IconChevronDown className="h-3.5 w-3.5 text-slate-500" />
    </button>
  );
}
function FileCard({
  meta,
  selected,
  onToggleSelect,
  onOpen,
  onDownload,
  onDelete,
  onStar,
  onTrash,
  onSpam,
  posterCache,
  active,
  onRestore,
  currentNav,
}: {
  meta: DriveRecordingMeta;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onStar: (flag: boolean) => void;
  onTrash: () => void;
  onSpam: (flag: boolean) => void;
  posterCache: Map<number, string>;
  active: boolean;
  onRestore?: () => void;
  currentNav: NavKey;
}) {
  const [thumb, setThumb] = useState<string>("");
  useEffect(() => {
    if (isFolder(meta)) return;
    const isVideo = (meta.mime || "").startsWith("video/") || (meta.ext || "") === "webm";
    if (!isVideo) return;
    const cached = posterCache.get(meta.id);
    if (cached) { setThumb(cached); return; }
    let revoked = false;
    (async () => {
      try {
        const blob = await getRecordingBlob(meta.id);
        const url = URL.createObjectURL(blob);
        const video = document.createElement("video");
        video.preload = "metadata";
        video.src = url;
        video.muted = true;
        video.playsInline = true;
        // Garantir o 1ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âº frame: esperar metadata e fazer seek para 0 (com fallback 0.01)
        await new Promise<void>((resolve) => {
          const onLoaded = () => {
            const onSeeked = () => resolve();
            video.addEventListener("seeked", onSeeked, { once: true });
            try { video.currentTime = 0; } catch { try { video.currentTime = 0.01; } catch { resolve(); } }
          };
          if (video.readyState >= 1) onLoaded(); else video.addEventListener("loadedmetadata", onLoaded, { once: true });
        });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, video.videoWidth);
        canvas.height = Math.max(1, video.videoHeight);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const data = canvas.toDataURL("image/jpeg", 0.6);
          posterCache.set(meta.id, data);
          setThumb(data);
        }
        if (!revoked) URL.revokeObjectURL(url);
      } catch {}
    })();
    return () => { revoked = true; };
  }, [meta.id, meta.mime, meta.ext, posterCache]);

  return (
    <div
      className={`group rounded-xl border ${
        active ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white"
      } shadow-sm hover:shadow-md transition-shadow overflow-hidden`}
    >
      <div className="px-3 pt-2 flex items-center justify-between">
        <label className="inline-flex items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" checked={selected} onChange={onToggleSelect} />
          {fmtDate(meta.createdAt)}
        </label>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
          <button
            className="px-2 py-1 rounded-lg hover:bg-slate-100"
            onClick={() => onStar(!(meta as any).starred)}
            title={(meta as any).starred ? "Remover estrela" : "Marcar estrela"}
          >
            <IconStar className={`h-4 w-4 ${(meta as any).starred ? 'text-yellow-500' : ''}`} />
          </button>
          {currentNav === 'trash' ? (
            <>
              {onRestore && (
                <button className="px-2 py-1 rounded-lg hover:bg-slate-100" onClick={onRestore} title="Restaurar">
                  <IconRefresh className="h-4 w-4" />
                </button>
              )}
              <button className="px-2 py-1 rounded-lg hover:bg-slate-100 text-rose-600" onClick={onDelete} title="Excluir definitivamente">
                <IconTrash className="h-4 w-4" />
              </button>
              <button className="px-2 py-1 rounded-lg hover:bg-slate-100" onClick={onDownload} title="Baixar">
                <IconDownload className="h-4 w-4" />
              </button>
            </>
          ) : currentNav === 'spam' ? (
            <>
              {onRestore && (
                <button className="px-2 py-1 rounded-lg hover:bg-slate-100" onClick={onRestore} title="Remover spam">
                  <IconAlert className="h-4 w-4" />
                </button>
              )}
              <button className="px-2 py-1 rounded-lg hover:bg-slate-100" onClick={onTrash} title="Mover para lixeira">
                <IconTrash className="h-4 w-4" />
              </button>
              <button className="px-2 py-1 rounded-lg hover:bg-slate-100" onClick={onDownload} title="Baixar">
                <IconDownload className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <button className="px-2 py-1 rounded-lg hover:bg-slate-100" onClick={() => onSpam(true)} title="Spam">
                <IconAlert className="h-4 w-4" />
              </button>
              <button className="px-2 py-1 rounded-lg hover:bg-slate-100" onClick={onDownload} title="Baixar">
                <IconDownload className="h-4 w-4" />
              </button>
              <button className="px-2 py-1 rounded-lg hover:bg-slate-100" onClick={onTrash} title="Mover para lixeira">
                <IconTrash className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
      <button className="w-full" onClick={() => { if (!isFolder(meta)) onOpen(); }} title={isFolder(meta) ? "Pasta" : "Abrir"}>
        {thumb && !isFolder(meta) ? (
          <img src={thumb} alt="capa do vÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­deo" className="aspect-video w-full object-cover" />
        ) : (
          <div className="aspect-video bg-slate-100 grid place-items-center">
            {isFolder(meta) ? (
              <IconFolder className="h-10 w-10" style={{ color: (meta as any).color || '#475569' }} />
            ) : (
              <FileThumb className="h-10 w-10 text-slate-500" />
            )}
          </div>
        )}
      </button>
      <div className="p-3">
        <div className="text-sm font-medium truncate" title={meta.name}>
          {meta.name || fallbackName(meta)}
        </div>
        <div className="text-xs text-slate-600">{isFolder(meta) ? '-' : fmtSize(meta.size)}</div>
      </div>
    </div>
  );
}

function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 grid place-items-center text-center text-slate-600">
      <div className="max-w-sm space-y-2">
        <div className="flex items-center justify-center gap-2 text-slate-700">
          <LogoDrive className="h-6 w-6" />
          <span className="font-medium">Seu Drive estÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ vazio</span>
        </div>
        <p className="text-sm">
          As gravaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âµes feitas no UpConect aparecem aqui automaticamente. VocÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âª tambÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©m pode importar arquivos locais.
        </p>
        <div className="pt-2">
          <button
            className="inline-flex items-center gap-2 rounded-full bg-indigo-600 text-white px-4 py-2 text-sm shadow hover:bg-indigo-700"
            onClick={onImport}
          >
            <IconPlus className="h-4 w-4" /> Importar arquivos
          </button>
        </div>
      </div>
    </div>
  );
}

function SideLink({ href, active = false, children }: { href: string; active?: boolean; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl no-underline ${
        active ? "bg-indigo-50 text-indigo-800" : "text-slate-700 hover:bg-slate-100"
      }`}
    >
      <span className="inline-flex h-5 w-5 items-center justify-center">
        <FileThumb className="h-4 w-4" />
      </span>
      <span className="text-sm">{children}</span>
    </a>
  );
}

function MenuItem({ icon, label, onClick, shortcut, chevron = false }: {
  icon: JSX.Element;
  label: string;
  onClick: () => void;
  shortcut?: string;
  chevron?: boolean;
}) {
  return (
    <button
      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 text-sm"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <span className="inline-flex h-5 w-5 items-center justify-center">{icon}</span>
      <span className="flex-1 text-left truncate">{label}</span>
      {shortcut ? <span className="text-[11px] text-slate-400">{shortcut}</span> : null}
      {chevron ? <IconChevronRight className="h-4 w-4 text-slate-400" /> : null}
    </button>
  );
}

function SortMenu({ sortKey, sortDir, onChange }: { sortKey: SortKey; sortDir: SortDir; onChange: (k: SortKey, d: SortDir) => void }) {
  const nextDir = (d: SortDir): SortDir => (d === "asc" ? "desc" : "asc");
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200">
      <button
        className="px-3 py-2 text-sm hover:bg-slate-100"
        onClick={() => onChange("createdAt", sortKey === "createdAt" ? nextDir(sortDir) : "desc")}
      >
        Data {sortKey === "createdAt" ? (sortDir === "asc" ? "\u2191" : "\u2193") : null}
      </button>
      <button className="px-3 py-2 text-sm hover:bg-slate-100" onClick={() => onChange("name", sortKey === "name" ? nextDir(sortDir) : "asc")}>
        Nome {sortKey === "name" ? (sortDir === "asc" ? "\u2191" : "\u2193") : null}
      </button>
      <button className="px-3 py-2 text-sm hover:bg-slate-100" onClick={() => onChange("size", sortKey === "size" ? nextDir(sortDir) : "desc")}>
        Tamanho {sortKey === "size" ? (sortDir === "asc" ? "\u2191" : "\u2193") : null}
      </button>
    </div>
  );
}

/* ---------- Menu de pessoas (filtro) ---------- */
function PeopleMenu({
  query,
  onQuery,
  onClose,
  onSelect,
  items,
  selfEmail,
}: {
  query: string;
  onQuery: (v: string) => void;
  onClose: () => void;
  onSelect: (f: PeopleFilter) => void;
  items: DriveRecordingMeta[];
  selfEmail: string | null;
}) {
  const emails = useMemo(() => {
    const set = new Set<string>();
    if (selfEmail) set.add(selfEmail);
    for (const it of items) {
      if (it.owner) set.add(it.owner);
      if (Array.isArray(it.people)) for (const p of it.people) set.add(p);
    }
    const arr = Array.from(set);
    arr.sort((a, b) => a.localeCompare(b));
    return arr;
  }, [items, selfEmail]);

  const filtered = emails.filter((e) => (query ? e.toLowerCase().includes(query.toLowerCase()) : true));
  const myLabel = (selfEmail ?? "Você").charAt(0).toUpperCase();

  return (
    <div className="absolute z-50 top-[44px] left-0 w-80 rounded-xl bg-white ring-1 ring-slate-200 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
      <div className="p-2">
        <div className="flex items-center gap-2 rounded-lg ring-1 ring-slate-200 bg-white px-2 h-9">
          <IconSearch className="h-4 w-4 text-slate-500" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Pesquisar pessoas e grupos"
            className="bg-transparent outline-none text-sm w-full"
          />
        </div>
      </div>
      <div className="max-h-72 overflow-auto">
        <button
          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 text-sm"
          onClick={() => onSelect({ kind: "me" })}
        >
          <AvatarCircle label={myLabel} />
          <div className="min-w-0">
            <div className="truncate">Você</div>
            {selfEmail ? <div className="text-xs text-slate-600 truncate">{selfEmail}</div> : null}
          </div>
          <span className="ml-auto text-xs text-slate-500">Minha conta</span>
        </button>
        {filtered.map((e) => (
          <button
            key={e}
            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 text-sm"
            onClick={() => onSelect({ kind: "email", email: e })}
          >
            <AvatarCircle label={e.charAt(0).toUpperCase()} />
            <div className="min-w-0">
              <div className="truncate">{e}</div>
            </div>
            <span className="ml-auto text-xs text-slate-500">Selecionar</span>
          </button>
        ))}
      </div>
      <div className="border-t border-slate-200">
        <button
          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 text-sm"
          onClick={() => onSelect({ kind: "anyone" })}
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <IconLink className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-700">Qualquer pessoa com o link</div>
            <div className="text-xs text-slate-500">Compartilhe o link para liberar o acesso</div>
          </div>
        </button>
      </div>
    </div>
  );
}

function AvatarCircle({ label }: { label: string }) {
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-slate-700 text-xs font-medium">
      {label}
    </span>
  );
}

function IconChevronDown({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function IconChevronRight({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
function IconX({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}
function IconCalendar({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function IconCheck({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
function IconTune({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 6h16M8 6v8M4 18h16M16 18V8" />
    </svg>
  );
}
function IconHelp({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.5 9a3.5 3.5 0 0 1 6 2c0 2-2 2.5-2.5 3" />
      <circle cx="12" cy="17" r=".5" />
    </svg>
  );
}
function IconCheckCircle({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M16 10l-4 4-2-2" />
    </svg>
  );
}
function IconGear({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9v.2a2 2 0 0 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6h-.2a2 2 0 0 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9v-.2a2 2 0 0 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.2a2 2 0 0 1 0 4h-.2a1 1 0 0 0-.9.6Z" />
    </svg>
  );
}
function IconStar({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18.9 6.2 21l1.1-6.5L2.6 9.8l6.5-.9L12 3z" />
    </svg>
  );
}
function IconDotsGrid({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <g transform="translate(2 2)">
        {[0, 1, 2].map((r) =>
          [0, 1, 2].map((c) => <circle key={`${r}-${c}`} cx={c * 8 + 2} cy={r * 8 + 2} r="1.6" />)
        )}
      </g>
    </svg>
  );
}
function FileThumb({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M8 12h8M8 16h5M8 8h6" />
    </svg>
  );
}
function IconFolder({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 6h6l2 2h10v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" />
    </svg>
  );
}
function IconDoc({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 2h8l4 4v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}
function IconSheet({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M8 3v18M3 8h18M13 8v13" />
    </svg>
  );
}
function IconSlides({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M8 10l6 3-6 3v-6z" />
    </svg>
  );
}
function IconPlay({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7-11-7z" />
    </svg>
  );
}
function IconForm({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 8h10M7 12h10M7 16h6" />
    </svg>
  );
}
function IconImage({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="M21 15l-5-5-7 7" />
    </svg>
  );
}
function IconPDF({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 2h8l4 4v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
      <path d="M14 2v6h6" />
      <path d="M8 14h2a2 2 0 0 0 0-4H8v4zm5-4h2v4h-2zm4 0h2a2 2 0 0 1 0 4h-2v-4z" />
    </svg>
  );
}
function IconVideoCam({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="M16 10l5-3v10l-5-3v-4z" />
    </svg>
  );
}
function IconZip({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 2h8l4 4v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
      <path d="M12 6v2M12 10v2M12 14v4" />
    </svg>
  );
}
function IconAudio({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}
function IconBrush({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 4l6 6-8 8H6v-6l8-8z" />
    </svg>
  );
}
function IconGlobe({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15 15 0 0 0 0 20M12 2a15 15 0 0 1 0 20" />
    </svg>
  );
}
function IconShortcut({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 6h8v8" />
      <path d="M18 6L6 18" />
    </svg>
  );
}
function LogoDrive({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path d="M7 3h5l5 8-5 8H7L2 11 7 3Z" fill="#1a73e8" />
      <path d="M12 3h5l5 8-5 8h-5l5-8-5-8Z" fill="#34a853" />
      <path d="M2 11h10l5 8H7l-5-8Z" fill="#fbbc05" />
    </svg>
  );
}
function IconSearch({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21 16.7 16.7" />
    </svg>
  );
}
function IconGrid({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
function IconList({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="4" y="5" width="16" height="2" rx="1" />
      <rect x="4" y="11" width="16" height="2" rx="1" />
      <rect x="4" y="17" width="16" height="2" rx="1" />
    </svg>
  );
}
function IconSort({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 7h8" />
      <path d="M6 12h5" />
      <path d="M6 17h2" />
    </svg>
  );
}
function IconInfo({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

function IconPencil({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 11.5-12.5z" />
    </svg>
  );
}
function IconMoreVert({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  );
}
function IconRefresh({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6" />
    </svg>
  );
}
function IconPlus({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function IconTrash({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18M8 6l1-2h6l1 2M6 6v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6" />
    </svg>
  );
}
function IconDownload({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12M7 10l5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  );
}

function IconGmail({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 22.8 8 10v28c0 1.1.9 2 2 2h6V22.8l8 6 8-6V40h6c1.1 0 2-.9 2-2V10l-16 12.8Z"/>
      <path fill="#4285F4" d="M40 10h-4v9.2l4-3V10Z"/>
      <path fill="#34A853" d="M8 10h4v9.2l-4-3V10Z"/>
      <path fill="#FBBC05" d="M24 26.8 8 14v-2l16 12.8L40 12v2L24 26.8Z"/>
    </svg>
  );
}
function IconMeet({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <path fill="#1A73E8" d="M6 12a6 6 0 0 1 6-6h18v12H6V12Z"/>
      <path fill="#EA4335" d="M30 6h6a6 6 0 0 1 6 6v6h-12V6Z"/>
      <path fill="#34A853" d="M6 18h24v12H12a6 6 0 0 1-6-6v-6Z"/>
      <path fill="#FBBC05" d="M36 18h6v12a6 6 0 0 1-6 6h-6V18h6Z"/>
    </svg>
  );
}
function IconUpConect({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="#4f46e5" />
      <path d="M7 15V9l5-3 5 3v6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2" fill="#fff" />
    </svg>
  );
}
function IconUsers({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IconClock({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}
function IconAlert({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12" y2="17" />
    </svg>
  );
}
function IconCloud({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" />
      <path d="M16 16h1a3 3 0 0 0 0-6h-1" />
    </svg>
  );
}
function IconComputer({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <path d="M8 21h8" />
    </svg>
  );
}
function IconUpload({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12" />
      <path d="M7 8l5-5 5 5" />
      <path d="M5 20h14" />
    </svg>
  );
}
function IconMapPin({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 10c0 6-9 12-9 12S3 16 3 10a9 9 0 1 1 18 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
function IconLink({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1" />
      <path d="M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1" />
    </svg>
  );
}
function IconScript({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 18 22 12 16 6" />
      <path d="M8 6 2 12l6 6" />
    </svg>
  );
}

/* ====== Utils ====== */
function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
function fmtDate(ts: number): string {
  try {
    return new Date(ts).toLocaleString('pt-BR', { hour12: false });
  } catch {
    return "";
  }
}
function formatModifiedLabel(f: ModifiedFilter): string {
  if (f.preset === "last7") return "Últimos 7 dias";
  if (f.preset === "last30") return "Últimos 30 dias";
  if (f.preset !== "custom") return labelForPreset(f);
  if (typeof f.from === "number" && typeof f.to === "number") {
    const yf = new Date(f.from).getFullYear();
    const yt = new Date(f.to).getFullYear();
    const sameYear = yf === yt;
    const left = new Date(f.from).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      ...(sameYear ? {} : { year: "numeric" }),
    });
    const right = new Date(f.to).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    return `${left} - ${right}`;
  }
  return labelForPreset(f);
}

function fallbackName(r: DriveRecordingMeta): string {
  return `Gravação (${fmtDate(r.createdAt)})`;
}

function isFolder(meta: DriveRecordingMeta): boolean {
  const mime = (meta.mime || '').toLowerCase();
  const ext = (meta.ext || '').toLowerCase();
  const src = (meta.source || '').toLowerCase();
  return mime === 'inode/directory' || ext === 'folder' || src === 'folder';
}

// ===== Tipo (filtro)
const TYPE_OPTIONS: { key: TypeKey; label: string; icon: (p: { className?: string }) => JSX.Element }[] = [
  { key: "all",        label: "Todos os tipos", icon: (p) => <FileThumb {...p} /> },
  { key: "folders",    label: "Pastas",         icon: (p) => <IconFolder {...p} /> },
  { key: "documents",  label: "Documentos",     icon: (p) => <IconDoc {...p} /> },
  { key: "sheets",     label: "Planilhas",      icon: (p) => <IconSheet {...p} /> },
  { key: "slides",     label: "Apresentações",  icon: (p) => <IconSlides {...p} /> },
  { key: "vids",       label: "Vids",           icon: (p) => <IconPlay {...p} /> },
  { key: "gems",       label: "Gems",           icon: (p) => <IconStar {...p} /> },
  { key: "forms",      label: "Formulários",    icon: (p) => <IconForm {...p} /> },
  { key: "images",     label: "Fotos e imagens",icon: (p) => <IconImage {...p} /> },
  { key: "pdfs",       label: "PDFs",           icon: (p) => <IconPDF {...p} /> },
  { key: "videos",     label: "Vídeos",         icon: (p) => <IconVideoCam {...p} /> },
  { key: "archives",   label: "Arquivos (.zip)",icon: (p) => <IconZip {...p} /> },
  { key: "audio",      label: "Áudio",          icon: (p) => <IconAudio {...p} /> },
  { key: "drawings",   label: "Desenhos",       icon: (p) => <IconBrush {...p} /> },
  { key: "sites",      label: "Sites",          icon: (p) => <IconGlobe {...p} /> },
  { key: "shortcuts",  label: "Atalhos",        icon: (p) => <IconShortcut {...p} /> },
];

const VIDEO_EXT = new Set(["mp4", "mov", "mkv", "webm", "avi", "mpg", "mpeg", "wmv"]); 
const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "heic"]);
const AUDIO_EXT = new Set(["mp3", "wav", "ogg", "flac", "m4a", "aac", "opus"]);
const ARCHIVE_EXT = new Set(["zip", "rar", "7z", "tar", "gz", "tgz", "bz2"]);
const DOC_EXT = new Set(["doc", "docx", "odt", "rtf", "txt", "md"]);
const SHEET_EXT = new Set(["xls", "xlsx", "csv", "tsv", "ods"]);
const SLIDE_EXT = new Set(["ppt", "pptx", "odp", "key"]);

function getExtFromName(name?: string): string {
  if (!name) return "";
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

// ====== Filtros do Nav lateral
function matchNav(meta: DriveRecordingMeta, nav: NavKey, selfEmail: string | null): boolean {
  const notTrashSpam = !(meta as any).trashed && !(meta as any).spam;
  switch (nav) {
    case "my":
      return notTrashSpam;
    case "shared":
      return notTrashSpam && ((meta.people && meta.people.length > 0) || !!meta.anyone);
    case "shared_drives":
      return notTrashSpam && ((meta.people && meta.people.length > 0) || !!meta.anyone);
    case "computers": {
      const src = (meta.source || "").toLowerCase();
      return notTrashSpam && (src === "" || src === "local");
    }
    case "recent": {
      if (!notTrashSpam) return false;
      const [from, to] = lastNDaysRange(30);
      return meta.createdAt >= from && meta.createdAt <= to;
    }
    case "starred":
      return notTrashSpam && !!(meta as any).starred;
    case "spam":
      return !!(meta as any).spam;
    case "trash":
      return !!(meta as any).trashed;
    case "storage":
      return true;
    default:
      return true;
  }
}

function matchType(meta: DriveRecordingMeta, type: TypeKey): boolean {
  if (type === "all") return true;
  const ext = (meta.ext || getExtFromName(meta.name)).toLowerCase();
  const mime = (meta.mime || "").toLowerCase();
  switch (type) {
    case "folders":
      return mime === "inode/directory" || (meta.source === "folder");
    case "documents":
      return DOC_EXT.has(ext);
    case "sheets":
      return SHEET_EXT.has(ext);
    case "slides":
      return SLIDE_EXT.has(ext);
    case "vids":
    case "videos":
      return mime.startsWith("video/") || VIDEO_EXT.has(ext) || ext === "webm";
    case "gems":
      return false;
    case "forms":
      return false;
    case "images":
      return mime.startsWith("image/") || IMAGE_EXT.has(ext);
    case "pdfs":
      return mime === "application/pdf" || ext === "pdf";
    case "archives":
      return ARCHIVE_EXT.has(ext) || mime === "application/zip";
    case "audio":
      return mime.startsWith("audio/") || AUDIO_EXT.has(ext);
    case "drawings":
      return ext === "svg"; // aproximaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o
    case "sites":
      return ext === "html" || ext === "htm";
    case "shortcuts":
      return ext === "url" || ext === "lnk";
    default:
      return true;
  }
}

function matchPeople(meta: DriveRecordingMeta, pf: PeopleFilter, selfEmail: string | null): boolean {
  if (pf.kind === "all") return true;
  if (pf.kind === "anyone") return !!meta.anyone;
  if (pf.kind === "me") {
    const owner = (meta.owner || "eu").toLowerCase();
    const self = (selfEmail || "eu").toLowerCase();
    return owner === self || owner === "eu";
  }
    if (pf.kind === "email") {
    const em = pf.email.toLowerCase();
    if ((meta.owner || "").toLowerCase() === em) return true;
    if (Array.isArray(meta.people)) return meta.people.some((p: string | undefined) => (p || "").toLowerCase() === em);
  }
  return true;
}

// ====== Filtro modificaÃƒÂ§ÃƒÂ£o (datas)
type ModifiedPreset = "all" | "today" | "last7" | "last30" | "thisYear" | "lastYear" | "custom";
type ModifiedFilter = { preset: ModifiedPreset; from?: number; to?: number };

function startOfDay(ts: number): number { const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime(); }
function endOfDay(ts: number): number { const d = new Date(ts); d.setHours(23,59,59,999); return d.getTime(); }
function todayRange(): [number, number] { const now = Date.now(); return [startOfDay(now), endOfDay(now)]; }
function lastNDaysRange(n: number): [number, number] { const now = new Date(); const to = endOfDay(now.getTime()); const fromDate = new Date(now); fromDate.setDate(now.getDate() - (n - 1)); const from = startOfDay(fromDate.getTime()); return [from, to]; }
function thisYearRange(): [number, number] { const y = new Date().getFullYear(); const from = new Date(y,0,1,0,0,0,0).getTime(); const to = new Date(y,11,31,23,59,59,999).getTime(); return [from, to]; }
function lastYearRange(): [number, number] { const y = new Date().getFullYear() - 1; const from = new Date(y,0,1,0,0,0,0).getTime(); const to = new Date(y,11,31,23,59,59,999).getTime(); return [from, to]; }

function computeRange(f: ModifiedFilter): [number, number] | null {
  switch (f.preset) {
    case "all": return null;
    case "today": return todayRange();
    case "last7": return lastNDaysRange(7);
    case "last30": return lastNDaysRange(30);
    case "thisYear": return thisYearRange();
    case "lastYear": return lastYearRange();
    case "custom":
      if (typeof f.from === "number" && typeof f.to === "number") return [f.from, f.to];
      return null;
  }
}
function labelForPreset(f: ModifiedFilter): string {
  const y = new Date().getFullYear();
  switch (f.preset) {
    case "today": return "Hoje";
    case "last7": return "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ltimos 7 dias";
    case "last30": return "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ltimos 30 dias";
    case "thisYear": return `Este ano (${y})`;
    case "lastYear": return `Ano passado (${y-1})`;
    case "custom": return "PerÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­odo personalizado";
    default: return "Todos";
  }
}

// ====== Fonte (Gmail/Meet)
function matchSource(meta: DriveRecordingMeta, s: SourceKey): boolean {
  if (s === 'all') return true;
  const src = (meta.source || '').toLowerCase();
  if (s === 'upconect') {
    // compat: alguns itens antigos foram salvos como 'meet'
    return src === 'upconect' || src === 'meet';
  }
  return src === s;
}
function dateInputValue(ts?: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}
function parseDateInput(s: string): number | null {
  if (!s) return null;
  const t = Date.parse(s);
  return isNaN(t) ? null : startOfDay(t);
}

function ModifiedMenu({ tmp, onTmpChange, from, to, onFrom, onTo, onApply, onCancel, onClear, onQuick }: {
  tmp: ModifiedFilter;
  onTmpChange: (f: ModifiedFilter) => void;
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  onApply: () => void;
  onCancel: () => void;
  onClear: () => void;
  onQuick?: (f: ModifiedFilter) => void;
}) {
  const y = new Date().getFullYear();
  const [showCustom, setShowCustom] = useState(tmp.preset === 'custom');
  const Item = ({ label, sel, onClick }: { label: string; sel: boolean; onClick: () => void }) => (
    <button className={`w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 ${sel ? 'bg-slate-100' : ''}`} onClick={onClick}>{label}</button>
  );
  const isCustom = showCustom || tmp.preset === 'custom';
  return (
    <div className={`absolute z-50 top-[44px] left-0 ${isCustom ? 'w-[520px]' : 'w-72'} rounded-xl bg-white ring-1 ring-slate-200 shadow-2xl`} onClick={(e) => e.stopPropagation()}>
      {isCustom ? (
        <div className="grid grid-cols-[220px_1fr]">
          <div className="p-1">
            <Item label="Hoje" sel={tmp.preset === 'today'} onClick={() => { onTmpChange({ preset: 'today' }); onQuick?.({ preset: 'today' }); }} />
            <Item label="ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ltimos sete dias" sel={tmp.preset === 'last7'} onClick={() => { onTmpChange({ preset: 'last7' }); onQuick?.({ preset: 'last7' }); }} />
            <Item label="ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ltimos 30 dias" sel={tmp.preset === 'last30'} onClick={() => { onTmpChange({ preset: 'last30' }); onQuick?.({ preset: 'last30' }); }} />
            <Item label={`Este ano (${y})`} sel={tmp.preset === 'thisYear'} onClick={() => { onTmpChange({ preset: 'thisYear' }); onQuick?.({ preset: 'thisYear' }); }} />
            <Item label={`Ano passado (${y-1})`} sel={tmp.preset === 'lastYear'} onClick={() => { onTmpChange({ preset: 'lastYear' }); onQuick?.({ preset: 'lastYear' }); }} />
            <div className={`px-3 py-2 rounded-lg bg-slate-100`}>
              <button type="button" className="w-full text-left" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setShowCustom(true); onTmpChange({ preset: 'custom' }); }} onClick={(e) => e.stopPropagation()}>PerÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­odo personalizado</button>
            </div>
          </div>
          <div className="border-l border-slate-200 p-3">
            <div className="grid grid-cols-1 gap-3" onClick={(e)=>e.stopPropagation()}>
              <DateField label="Depois de" value={from} onChange={onFrom} />
              <DateField label="Antes de" value={to} onChange={onTo} />
            </div>
          </div>
        </div>
      ) : (
        <div className="p-1">
          <Item label="Hoje" sel={tmp.preset === 'today'} onClick={() => { onTmpChange({ preset: 'today' }); onQuick?.({ preset: 'today' }); }} />
          <Item label="ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ltimos sete dias" sel={tmp.preset === 'last7'} onClick={() => { onTmpChange({ preset: 'last7' }); onQuick?.({ preset: 'last7' }); }} />
          <Item label="ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ltimos 30 dias" sel={tmp.preset === 'last30'} onClick={() => { onTmpChange({ preset: 'last30' }); onQuick?.({ preset: 'last30' }); }} />
          <Item label={`Este ano (${y})`} sel={tmp.preset === 'thisYear'} onClick={() => { onTmpChange({ preset: 'thisYear' }); onQuick?.({ preset: 'thisYear' }); }} />
          <Item label={`Ano passado (${y-1})`} sel={tmp.preset === 'lastYear'} onClick={() => { onTmpChange({ preset: 'lastYear' }); onQuick?.({ preset: 'lastYear' }); }} />
          <div className={`px-3 py-2 rounded-lg hover:bg-slate-100`}>
            <button type="button" className="w-full text-left" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setShowCustom(true); onTmpChange({ preset: 'custom' }); }} onClick={(e) => e.stopPropagation()}>PerÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­odo personalizado</button>
          </div>
        </div>
      )}
      <div className="border-t border-slate-200 px-2 py-2 flex items-center justify-end gap-3 text-sm">
        <button className="text-slate-500 hover:text-slate-700" onClick={onClear}>Remover tudo</button>
        <button className="text-slate-600 hover:text-slate-900" onClick={onCancel}>Cancelar</button>
        <button className="text-blue-600 hover:text-blue-700 font-medium" onClick={onApply}>Aplicar</button>
      </div>
    </div>
  );
}
function SidebarNav({ selfEmail, active, onFilter }: { selfEmail: string | null; active: NavKey; onFilter: (k: NavKey) => void }) {
// Comparador central de ordenaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o
function compareRows(a: DriveRecordingMeta, b: DriveRecordingMeta): number {
  // Pastas primeiro (opcional)
  try {
    // foldersTop e sortKey/sortDir estÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o em escopo do componente via closure; se nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o, caÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­mos no padrÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o
  } catch {}
  // Implementado dentro do componente; esta declaraÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© substituÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­da abaixo via closure
  return 0;
}
  const Item = ({ k, label, icon }: { k: NavKey; label: string; icon: JSX.Element }) => (
    <button
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm ${active === k ? 'bg-indigo-50 text-indigo-800' : 'text-slate-700 hover:bg-slate-100'}`}
      onClick={() => onFilter(k)}
    >
      <span className="inline-flex h-5 w-5 items-center justify-center">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
  return (
    <nav className="text-sm">
      <Item k="my" label="Meu Drive" icon={<IconFolder className="h-4 w-4" />} />
      <Item k="shared_drives" label="Drives compartilhados" icon={<IconGlobe className="h-4 w-4" />} />
      <Item k="computers" label="Computadores" icon={<IconComputer className="h-4 w-4" />} />
      <Item k="shared" label="Compartilhados comigo" icon={<IconUsers className="h-4 w-4" />} />
      <Item k="recent" label="Recentes" icon={<IconClock className="h-4 w-4" />} />
      <Item k="starred" label="Com estrela" icon={<IconStar className="h-4 w-4" />} />
      <Item k="spam" label="Spam" icon={<IconAlert className="h-4 w-4" />} />
      <Item k="trash" label="Lixeira" icon={<IconTrash className="h-4 w-4" />} />
      <div className="mt-3 pt-3 border-t border-slate-200">
        <Item k="storage" label="Armazenamento" icon={<IconCloud className="h-4 w-4" />} />
      </div>
    </nav>
  );
}

// ====== Calendário compacto (custom) ======
function CalendarCompact({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const months = [
  'janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'
  ];
  const selected = useMemo(() => {
    if (!value) return null;
    const t = Date.parse(value);
    return isNaN(t) ? null : new Date(t);
  }, [value]);
  const [cursor, setCursor] = useState<Date>(() => {
    const base = selected ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay(); // 0=Dom

  const weeks: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) weeks.push(null);
  for (let d = 1; d <= daysInMonth; d++) weeks.push(d);

  function ymd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function setToday() {
    const now = new Date();
    onChange(ymd(now));
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
  }
  function clear() { onChange(''); }

  const isSelected = (d: number): boolean => {
    if (!selected) return false;
    return selected.getFullYear() === year && selected.getMonth() === month && selected.getDate() === d;
  };

  return (
    <div className="rounded-lg border border-slate-200 p-2 bg-white text-slate-800 w-[236px]">
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-medium capitalize">{months[month]} de {year}</div>
        <div className="inline-flex gap-1">
          <button className="h-6 w-6 grid place-items-center rounded hover:bg-slate-100" onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="MÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âªs anterior">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹</button>
          <button className="h-6 w-6 grid place-items-center rounded hover:bg-slate-100" onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="PrÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³ximo mÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âªs">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âº</button>
        </div>
      </div>
      <div className="text-[11px] grid grid-cols-7 gap-1 text-center text-slate-500 mb-1">
        <div>D</div><div>S</div><div>T</div><div>Q</div><div>Q</div><div>S</div><div>S</div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weeks.map((d, i) => d == null ? (
          <div key={i} />
        ) : (
          <button
            key={i}
            className={`h-8 w-8 text-sm grid place-items-center rounded-md hover:bg-slate-100 ${isSelected(d) ? 'bg-blue-600 text-white hover:bg-blue-600' : ''}`}
            onClick={() => onChange(ymd(new Date(year, month, d)))}
          >
            {d}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-[12px]">
        <button className="text-slate-600 hover:text-slate-900" onClick={clear}>Limpar</button>
        <div className="text-slate-400">{label}</div>
        <button className="text-blue-600 hover:text-blue-700" onClick={setToday}>Hoje</button>
      </div>
    </div>
  );
}

// ====== Campo de data estilizado ======
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="w-full">
      <div className="text-[12px] text-slate-600 mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="dd/mm/aaaa"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {value ? (
          <button
            type="button"
            className="h-8 w-8 grid place-items-center rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            aria-label="Limpar data"
          >
            <IconX className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}









