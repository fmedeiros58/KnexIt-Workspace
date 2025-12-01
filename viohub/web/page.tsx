"use client";

export default function VioHubWebPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-12 space-y-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">Produto</p>
          <h1 className="text-3xl md:text-4xl font-bold">VioHub</h1>
          <p className="text-base text-slate-700">
            Produção e entrega audiovisual do ecossistema KnexIT. Área autenticada placeholder para futura UI.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6 space-y-3 text-sm text-slate-700 shadow-sm">
          <p>
            Esta página representa a home web do VioHub enquanto a interface é construída. Concentre aqui projetos,
            clipes, roteiros e entregas conectadas ao SupaDrive e aos demais produtos.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Pipeline de produção e aprovação de vídeos.</li>
            <li>Integração planejada com SupaDrive para assets e entregas.</li>
            <li>Colaboração de roteiros, timelines e revisão.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
