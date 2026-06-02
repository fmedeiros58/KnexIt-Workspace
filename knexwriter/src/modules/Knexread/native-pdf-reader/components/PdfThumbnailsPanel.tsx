"use client";

import { useEffect, useRef, useState } from "react";
import type { NativePdfSession } from "../services";
import {
  isRenderCancellation,
  renderKnexPdfPageToCanvas,
} from "../knex-pdf-engine";

const THUMBNAIL_RENDER_WIDTH = 240;

type CachedThumbnail = {
  src: string;
  ratio: number;
};

const thumbnailCache = new WeakMap<NativePdfSession, Map<string, CachedThumbnail>>();

export function PdfThumbnailsPanel({
  session,
  pageCount,
  currentPage,
  onGoToPage,
}: {
  session?: NativePdfSession;
  pageCount: number;
  currentPage: number;
  onGoToPage: (page: number) => void;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(164px,1fr))] gap-3">
      {Array.from({ length: Math.max(1, pageCount) }, (_, index) => {
        const page = index + 1;
        const active = page === currentPage;
        return (
          <button
            key={`pdf-thumb-${page}`}
            type="button"
            onClick={() => onGoToPage(page)}
            className={`block min-w-0 rounded-sm border px-2 py-2 text-left text-xs transition-colors ${
              active
                ? "border-red-500 bg-red-50 text-zinc-900"
                : "border-transparent bg-transparent hover:bg-zinc-100"
            }`}
          >
            <PdfThumbnailImage session={session} pageNumber={page} active={active} />
            <p className="mt-1 text-center text-sm font-medium text-zinc-900">{page}</p>
          </button>
        );
      })}
    </div>
  );
}

function PdfThumbnailImage({
  session,
  pageNumber,
  active,
}: {
  session?: NativePdfSession;
  pageNumber: number;
  active: boolean;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [ratio, setRatio] = useState(1.414);
  const [thumbnailSrc, setThumbnailSrc] = useState<string | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "360px" },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!session || !visible) return;

    let cancelled = false;
    const abortController = new AbortController();
    const devicePixelRatio =
      typeof window !== "undefined" ? Math.round((window.devicePixelRatio || 1) * 100) : 100;
    const cacheKey = `${pageNumber}:${THUMBNAIL_RENDER_WIDTH}:${devicePixelRatio}`;
    const sessionCache = thumbnailCache.get(session) ?? new Map<string, CachedThumbnail>();

    if (!thumbnailCache.has(session)) {
      thumbnailCache.set(session, sessionCache);
    }

    const cached = sessionCache.get(cacheKey);
    if (cached) {
      setRatio(cached.ratio);
      setThumbnailSrc(cached.src);
      return;
    }

    const render = async () => {
      try {
        const page = await session.pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        const nextRatio = viewport.height / Math.max(1, viewport.width);
        const workerCanvas = document.createElement("canvas");

        await renderKnexPdfPageToCanvas({
          session,
          pageNumber,
          canvas: workerCanvas,
          scale: THUMBNAIL_RENDER_WIDTH / Math.max(1, viewport.width),
          quality: "auto",
          signal: abortController.signal,
        });

        if (cancelled || abortController.signal.aborted) return;

        const nextThumbnail: CachedThumbnail = {
          src: workerCanvas.toDataURL("image/png"),
          ratio: nextRatio,
        };
        sessionCache.set(cacheKey, nextThumbnail);
        setRatio(nextRatio);
        setThumbnailSrc(nextThumbnail.src);
      } catch (error) {
        if (!cancelled && !isRenderCancellation(error)) {
          setThumbnailSrc(null);
        }
      }
    };

    void render();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [pageNumber, session, visible]);

  return (
    <div
      ref={rootRef}
      className={`mx-auto flex w-full max-w-[260px] items-center justify-center border bg-white shadow-sm ${
        active ? "border-red-500" : "border-zinc-300"
      }`}
      style={{ aspectRatio: `1 / ${ratio}` }}
    >
      {session && thumbnailSrc ? (
        <img
          src={thumbnailSrc}
          alt={`Página ${pageNumber}`}
          className="block h-full w-full object-contain"
          draggable={false}
        />
      ) : (
        <span className="text-[11px] text-zinc-500">Página {pageNumber}</span>
      )}
    </div>
  );
}
