"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getRecordingBlob, listRecordings, type DriveRecordingMeta } from "@/lib/recstore";

export default function DriveViewerPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const recordId = Number(params.id);
  const [meta, setMeta] = useState<DriveRecordingMeta | null>(null);
  const [src, setSrc] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const rows = await listRecordings();
        const found = rows.find((r) => r.id === recordId) || null;
        if (!found) {
          setError("Arquivo não encontrado.");
          setLoading(false);
          return;
        }
        if (cancelled) return;
        setMeta(found);
        const blob = await getRecordingBlob(found.id);
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setSrc(url);
      } catch (err) {
        console.error("Falha ao abrir vídeo", err);
        if (!cancelled) setError("Não foi possível carregar o vídeo.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
      if (src) URL.revokeObjectURL(src);
    };
  }, [recordId, src]);

  const title = meta?.name || "Visualizador";
  const humanSize = useMemo(() => {
    if (!meta) return "";
    const size = meta.size;
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }, [meta]);

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      <header className="border-b border-white/10 bg-[#1b1b1b] px-6 py-4">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#d93025] text-lg font-bold text-white shadow-inner">
              Vid
            </span>
            <div>
              <p className="text-base font-semibold text-white">{title}</p>
              <nav className="mt-2 flex items-center gap-5 text-[15px] font-semibold text-white/70">
                {["Arquivo", "Acessar", "Inserir", "Ferramentas", "Ajuda"].map((label) => (
                  <span key={label} className="hover:text-white">
                    {label}
                  </span>
                ))}
              </nav>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-white/20 bg-gradient-to-r from-[#a855f7] to-[#7c3aed] px-4 py-2 text-sm font-semibold text-white shadow hover:from-[#9333ea] hover:to-[#6d28d9]"
            >
              <IconPlay className="h-3.5 w-3.5" />
              Abrir com o Google Vids
              <IconChevronDown className="h-3 w-3 text-white/80" />
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-white/20 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              <IconLink className="h-4 w-4" />
              Compartilhar
              <IconChevronDown className="h-3 w-3 text-white/80" />
            </button>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-sm font-semibold">
              {meta?.owner?.slice(0, 1).toUpperCase() || "U"}
            </span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#272727] px-4 py-3 text-sm text-white/80">
          <div className="flex flex-wrap items-center gap-2">
            <button className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 hover:bg-white/10">
              <IconDownload className="h-4 w-4" />
              Download
            </button>
            <button className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 hover:bg-white/10">
              <IconScript className="h-4 w-4" />
              Transcrição
            </button>
            <button className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 hover:bg-white/10">
              <IconComment className="h-4 w-4" />
              Comentário
            </button>
          </div>
          <button className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 hover:bg-white/10">
            <IconChevronDown className="h-4 w-4" />
          </button>
        </div>
      </header>
      <main className="px-6 py-6">
        {loading && (
          <div className="flex min-h-[60vh] items-center justify-center text-sm text-white/60">
            Carregando vídeo...
          </div>
        )}
        {error && (
          <div className="flex min-h-[60vh] items-center justify-center text-sm text-rose-400">{error}</div>
        )}
        {!loading && !error && (
          <div className="mx-auto flex max-w-5xl flex-col gap-4">
            <div className="flex justify-between text-xs text-white/60">
              <span>{meta?.owner || "Você"}</span>
              <span>{humanSize}</span>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black p-4 shadow-2xl">
              {src ? (
                <video src={src} controls autoPlay playsInline className="mx-auto block h-auto w-full rounded-2xl bg-black" />
              ) : (
                <div className="flex min-h-[320px] items-center justify-center text-sm text-white/60">
                  Prévia indisponível
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function IconComment({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" />
    </svg>
  );
}

function IconPlay({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function IconChevronDown({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function IconLink({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l1.83-1.83a5 5 0 0 0-7.07-7.07L11.5 6" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-1.83 1.83a5 5 0 0 0 7.07 7.07L12.5 18" />
    </svg>
  );
}

function IconDownload({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

function IconScript({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 17v-7a2 2 0 0 1 2-2h6" />
      <path d="m16 5 3 3-3 3" />
      <path d="M6 17h11a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
