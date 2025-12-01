import Link from "next/link";

const PRODUCTS = [
  { name: "VioClass", slug: "vioclass", summary: "Cursos e trilhas de aulas em vídeo." },
  { name: "VioLive", slug: "violive", summary: "Salas ao vivo com agenda e gravação." },
  { name: "VioRecord", slug: "viorecord", summary: "Gravação de tela, webcam e voz no navegador." },
  { name: "VioStudio", slug: "viostudio", summary: "Edição e pós-produção online." },
  { name: "VioAnalytics", slug: "vioanalytics", summary: "Métricas e insights do ecossistema." },
  { name: "VioRead", slug: "vioread", summary: "Leitura assistida de PDFs e artigos." },
  { name: "SupaDrive", slug: "supadrive", summary: "Drive de arquivos para aulas e projetos." },
  { name: "KnexDocs", slug: "knexdocs", summary: "Documentos colaborativos em tempo real." },
  { name: "KnexFlow", slug: "knexflow", summary: "Orquestração e automações." },
  { name: "KnexChat", slug: "knexchat", summary: "Mensageria/omnichat integrado." },
  { name: "KnexSearch", slug: "knexsearch", summary: "Busca unificada com IA." },
  { name: "KnexAI", slug: "knexai", summary: "Camada unificada de IA para a suíte." },
  { name: "KnexMail", slug: "knexmail", summary: "E-mails e campanhas integradas." },
  { name: "KnexPay", slug: "knexpay", summary: "Cobrança e pagamentos da suíte." },
  { name: "KnexReview", slug: "knexreview", summary: "Revisão sistemática e triagem." },
];

export default function LobbyIndexPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-14 space-y-8">
        <header className="space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-600">Lobby</p>
          <h1 className="text-3xl md:text-4xl font-bold">Páginas de lobby externo</h1>
          <p className="text-lg text-slate-600">
            Escolha o produto para acessar a página de lobby antes da home autenticada.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCTS.map((p) => (
            <Link
              key={p.slug}
              href={`/lobby/${p.slug}`}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">{p.name}</h2>
                <span className="text-xs font-semibold text-emerald-600">Lobby</span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{p.summary}</p>
              <div className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-indigo-700">
                <span>Ir ao lobby</span>
                <span aria-hidden>→</span>
              </div>
            </Link>
          ))}
        </div>

        <div className="text-center text-sm text-slate-600">
          Precisa de branding/marketing? Consulte <Link href="/branding" className="text-indigo-600 font-semibold">/branding</Link>.
        </div>
      </div>
    </main>
  );
}
