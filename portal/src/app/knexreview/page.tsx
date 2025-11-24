import Link from "next/link";

export default function KnexReviewPage() {
  const problems = [
    "Construir estrategia de busca replicavel para revisao sistematica.",
    "Deduplicar e triar resultados de varias bases em um fluxo unico.",
    "Organizar extracao de dados e integracao com leitura assistida.",
  ];

  const features = [
    "Construcao de estrategias booleanas e registro das buscas.",
    "Execucao em multiplas fontes com adaptadores plugaveis.",
    "Triagem (screening) com decisoes de incluir/excluir.",
    "Extracao de dados e sumarios para exportar para KnexDocs ou VioRead.",
  ];

  const audiences = ["Pesquisadores e labs", "Grupos de revisao sistematica", "Pos-graduandos e orientadores"];

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-12 space-y-10">
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Produto</p>
          <h1 className="text-3xl md:text-4xl font-bold">KnexReview</h1>
          <p className="text-lg text-slate-700">Ferramenta para revisao sistematica de literatura com busca, triagem e extracao.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-slate-900">O que o KnexReview resolve</h2>
          <p className="text-base text-slate-700">Organiza o fluxo PRISMA com estrategias replicaveis e consolidacao de resultados.</p>
          <ul className="list-disc space-y-2 pl-5 text-slate-700">
            {problems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-slate-900">Principais recursos</h2>
          <ul className="list-disc space-y-2 pl-5 text-slate-700">
            {features.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-slate-900">Para quem é</h2>
          <ul className="list-disc space-y-2 pl-5 text-slate-700">
            {audiences.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <div>
          <Link
            href="/knexit-workspace"
            className="inline-flex rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-500"
          >
            Voltar ao KnexIT Workspace
          </Link>
        </div>
      </div>
    </main>
  );
}
