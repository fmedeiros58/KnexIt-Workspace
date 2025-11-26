"use client";

export default function KnexDocsPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-12 space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">Produto</p>
          <h1 className="text-3xl md:text-4xl font-bold">KnexDocs</h1>
          <p className="text-base text-slate-700">Repositório de documentos conectados ao ecossistema KnexIT. Placeholder.</p>
        </header>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700">
          Casca inicial para criação/edição/versão de docs integrados a SupaDrive, KnexAI e VioRead.
        </div>
      </div>
    </main>
  );
}
