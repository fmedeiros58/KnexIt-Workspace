"use client";

export default function VioRecordPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-12 space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-600">Produto</p>
          <h1 className="text-3xl md:text-4xl font-bold">VioRecord</h1>
          <p className="text-base text-slate-700">
            Gravação e gestão de sessões com integração ao ecossistema KnexIT. Casca inicial para futura especificação.
          </p>
        </header>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700">
          Este módulo é um placeholder. Defina aqui fluxo de gravação, ingestão e roteamento de arquivos quando as regras forem fornecidas.
        </div>
      </div>
    </main>
  );
}
