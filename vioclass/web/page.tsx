"use client";

export default function VioClassWebPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-12 space-y-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-600">Produto</p>
          <h1 className="text-3xl md:text-4xl font-bold">VioClass</h1>
          <p className="text-base text-slate-700">
            Hub de cursos e trilhas em vídeo. Área autenticada placeholder para navegação futura.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6 space-y-3 text-sm text-slate-700 shadow-sm">
          <p>
            Este espaço representa a home web do VioClass. Conecte aqui aulas, trilhas e lives do ecossistema enquanto a
            implementação final é desenvolvida.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Biblioteca de cursos e módulos com progresso.</li>
            <li>Integração futura com VioLive e SupaDrive para aulas gravadas.</li>
            <li>Painel de acompanhamento para alunos e instrutores.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
