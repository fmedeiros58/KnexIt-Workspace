import { create } from "zustand";
import type { ReaderState, RecentDocumentEntry } from "../lib/types";
import {
  DEFAULT_SOURCE_LANGUAGE,
  DEFAULT_TARGET_LANGUAGE,
  MAX_RECENT_DOCUMENTS,
  RECENT_DOCUMENTS_STORAGE_KEY,
  RECENT_DOCUMENTS_VERSION,
  RECENT_DOCUMENTS_VERSION_KEY,
} from "../lib/constants";
import { clamp } from "../lib/utils";

function hasWindow() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function sanitizeRecentEntry(value: unknown): RecentDocumentEntry | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Record<string, unknown>;
  if (
    typeof entry.id !== "string" ||
    typeof entry.hash !== "string" ||
    typeof entry.name !== "string" ||
    typeof entry.pageCount !== "number" ||
    typeof entry.openedAt !== "number"
  ) {
    return null;
  }

  return {
    id: entry.id,
    hash: entry.hash,
    name: entry.name,
    pageCount: entry.pageCount,
    sizeBytes: typeof entry.sizeBytes === "number" ? entry.sizeBytes : null,
    lastModified: typeof entry.lastModified === "number" ? entry.lastModified : null,
    openedAt: entry.openedAt,
    sourceLabel: typeof entry.sourceLabel === "string" && entry.sourceLabel.trim() ? entry.sourceLabel : "Arquivo local",
  };
}

function persistRecentDocuments(items: RecentDocumentEntry[]) {
  if (!hasWindow()) return;
  window.localStorage.setItem(RECENT_DOCUMENTS_STORAGE_KEY, JSON.stringify(items));
  window.localStorage.setItem(RECENT_DOCUMENTS_VERSION_KEY, RECENT_DOCUMENTS_VERSION);
}

function readPersistedRecentDocuments(): RecentDocumentEntry[] {
  if (!hasWindow()) return [];

  const version = window.localStorage.getItem(RECENT_DOCUMENTS_VERSION_KEY);
  if (version !== RECENT_DOCUMENTS_VERSION) {
    // Start a real history list from zero, ignoring previous mock/history payloads.
    persistRecentDocuments([]);
    return [];
  }

  const raw = window.localStorage.getItem(RECENT_DOCUMENTS_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizeRecentEntry).filter((item): item is RecentDocumentEntry => Boolean(item)).slice(0, MAX_RECENT_DOCUMENTS);
  } catch {
    return [];
  }
}

export const useReaderStore = create<ReaderState>((set, get) => ({
  document: null,
  pageNumber: 1,
  pageCount: 1,
  sourceLanguage: DEFAULT_SOURCE_LANGUAGE,
  targetLanguage: DEFAULT_TARGET_LANGUAGE,
  selected: null,
  translationCache: {},
  recentDocuments: [],
  setDocument: (document) => set({ document }),
  setPageNumber: (pageNumber) => {
    const pageCount = Math.max(1, get().pageCount || 1);
    set({ pageNumber: clamp(pageNumber, 1, pageCount) });
  },
  setPageCount: (pageCount) => {
    const nextCount = Math.max(1, pageCount || 1);
    const nextPage = clamp(get().pageNumber, 1, nextCount);
    set({ pageCount: nextCount, pageNumber: nextPage });
  },
  setSourceLanguage: (sourceLanguage) => set({ sourceLanguage }),
  setTargetLanguage: (targetLanguage) => set({ targetLanguage }),
  setSelected: (selected) => set({ selected }),
  setCachedTranslation: (key, pairs) =>
    set((state) => ({
      translationCache: {
        ...state.translationCache,
        [key]: pairs,
      },
    })),
  addRecentDocument: ({ descriptor, sizeBytes = null, lastModified = null, sourceLabel = "Arquivo local" }) =>
    set((state) => {
      const normalizedSize = typeof sizeBytes === "number" && Number.isFinite(sizeBytes) ? sizeBytes : null;
      const normalizedModified = typeof lastModified === "number" && Number.isFinite(lastModified) ? lastModified : null;
      const nextEntry: RecentDocumentEntry = {
        id: descriptor.id,
        hash: descriptor.hash,
        name: descriptor.name,
        pageCount: descriptor.pageCount,
        sizeBytes: normalizedSize,
        lastModified: normalizedModified,
        openedAt: Date.now(),
        sourceLabel: sourceLabel.trim() || "Arquivo local",
      };

      const nextItems = [nextEntry, ...state.recentDocuments.filter((item) => item.hash !== descriptor.hash)].slice(
        0,
        MAX_RECENT_DOCUMENTS,
      );
      persistRecentDocuments(nextItems);
      return { recentDocuments: nextItems };
    }),
  hydrateRecentDocuments: () =>
    set(() => ({
      recentDocuments: readPersistedRecentDocuments(),
    })),
  clearRecentDocuments: () =>
    set(() => {
      persistRecentDocuments([]);
      return { recentDocuments: [] };
    }),
  clearForNewDocument: () =>
    set(() => ({
      pageNumber: 1,
      selected: null,
      translationCache: {},
    })),
}));
