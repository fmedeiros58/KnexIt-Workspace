import Link from "next/link";

export default function KnexFlowPage() {
  const problems = [
    "Organizar tarefas e projetos de cursos ou labs em um quadro unico.",
    "Ter visibilidade de prazos, responsaveis e status.",
    "Conectar tarefas a materiais, aulas e documentos.",
  ];

  const features = [
    "Quadros kanban para turmas, labs ou equipes de conteudo.",
    "Cards com checklists, comentarios e anexos.",
    "Vinculo com materiais no SupaDrive ou documentos no KnexDocs.",
    "Visao por status e filtro rapido por responsavel.",
  ];

  const audiences = ["Professores e coordenacao", "Equipes de projeto ou laboratorio", "Times de conteudo e suporte"];

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-12 space-y-10">
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Produto</p>
          <h1 className="text-3xl md:text-4xl font-bold">KnexFlow</h1>
          <p className="text-lg text-slate-700">
            Tarefas, quadros e fluxos de trabalho para equipes educacionais, com ligacoes diretas a aulas e materiais.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-slate-900">O que o KnexFlow resolve</h2>
          <p className="text-base text-slate-700">Da visao unica de projetos academicos, desde preparacao de aulas ate execucao de eventos.</p>
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
