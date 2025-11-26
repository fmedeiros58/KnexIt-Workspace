"use client";

export default function KnexFlowPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-12 space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">Produto</p>
          <h1 className="text-3xl md:text-4xl font-bold">KnexFlow</h1>
          <p className="text-base text-slate-700">Orquestração e automações entre apps da suíte. Placeholder inicial.</p>
        </header>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700">
          Casca para modelar fluxos (triggers, ações) integrando VioClass, SupaDrive, KnexAI, etc.
        </div>
      </div>
    </main>
  );
}
