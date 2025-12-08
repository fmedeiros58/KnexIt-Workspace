"use client";

import { useEffect, useMemo } from "react";
import ReaderShell from "./components/ReaderShell";
import { useVioReadState } from "./hooks/useVioReadState";
import { useTranslationJob } from "./hooks/useTranslationJob";
import type { DocumentDescriptor } from "./lib/vioreadTypes";

export default function VioReadPage() {
  const {
    document,
    translated,
    mode,
    targetLang,
    sourceLang,
    setMode,
    setTargetLang,
    setSourceLang,
    setDocument,
    setTranslated,
    setActiveSectionId,
    activeSectionId,
  } = useVioReadState();

  const { translate, loading: translating, error: translateError } = useTranslationJob();

  // Trigger a mock translation whenever document or targetLang changes (MVP).
  useEffect(() => {
    if (!document) return;
    translate({ document, sourceLang, targetLang }).then((result) => setTranslated(result)).catch(() => {});
  }, [document, targetLang, sourceLang, translate, setTranslated]);

  const viewerData = useMemo(
    () => ({
      original: document,
      translated,
    }),
    [document, translated]
  );

  const handleSelectDocument = (descriptor: DocumentDescriptor) => {
    setDocument(descriptor);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 opacity-70" />
        <div className="relative mx-auto max-w-6xl px-6 py-10 space-y-6">
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-600">VioRead</p>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
              Leitura acadêmica assistida por IA, com tradução e visão lado a lado.
            </h1>
            <p className="text-base md:text-lg text-slate-600 max-w-3xl">
              Conecte-se ao SupaDrive ou envie seus PDFs/DOCX, traduza preservando a estrutura e peça explicações, resumos e fichamentos com KnexAI.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-indigo-700 ring-1 ring-indigo-100">
              🌐 Tradução com estrutura preservada
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700 ring-1 ring-emerald-100">
              📑 Original + traduzido lado a lado
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-slate-700 ring-1 ring-slate-200">
              🤖 IA para explicar, resumir e fichar
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <ReaderShell
            mode={mode}
            onModeChange={setMode}
            sourceLang={sourceLang}
            targetLang={targetLang}
            onSourceLangChange={setSourceLang}
            onTargetLangChange={setTargetLang}
            onSelectDocument={handleSelectDocument}
            viewerData={viewerData}
            translating={translating}
            translateError={translateError || null}
            activeSectionId={activeSectionId}
            onActiveSectionChange={setActiveSectionId}
          />
        </div>
      </div>
    </div>
  );
}
