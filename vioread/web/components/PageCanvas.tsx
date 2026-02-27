"use client";

import { useEffect, useRef, useState } from "react";
import type { DocumentPage } from "../lib/types";

type Props = {
  pageNumber: number;
  renderPage: (pageNumber: number, canvas: HTMLCanvasElement) => Promise<DocumentPage>;
  onRendered?: (page: DocumentPage) => void;
};

export default function PageCanvas({ pageNumber, renderPage, onRendered }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    renderPage(pageNumber, canvas)
      .then((pageInfo) => {
        if (cancelled) return;
        onRendered?.(pageInfo);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Erro ao renderizar página";
        if (message.includes("Nenhum documento PDF ativo")) {
          setError(null);
          return;
        }
        setError(message);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [onRendered, pageNumber, renderPage]);

  return (
    <>
      <canvas ref={canvasRef} className="reader-page-canvas" />
      {loading ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-white/55 text-xs text-slate-600">
          Renderizando página {pageNumber}...
        </div>
      ) : null}
      {error ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-rose-50/70 px-4 text-center text-xs text-rose-700">
          {error}
        </div>
      ) : null}
    </>
  );
}

