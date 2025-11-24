import Link from "next/link";

export default function KnexDocsPage() {
  const problems = [
    "Criar documentos colaborativos sem perder historico.",
    "Organizar pautas, atas e materiais com o time em um so lugar.",
    "Evitar copias isoladas e documentos dispersos em varios apps.",
  ];

  const features = [
    "Editor colaborativo em tempo quase real.",
    "Comentarios e marcacoes para revisao rapida.",
    "Templates para atas, roteiros de aula e projetos.",
    "Links diretos para materiais no SupaDrive ou tarefas no KnexFlow.",
  ];

  const audiences = ["Professores e coordenacao", "Times de conteudo", "Administracao academica", "Alunos em grupos de projeto"];

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-12 space-y-10">
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Produto</p>
          <h1 className="text-3xl md:text-4xl font-bold">KnexDocs</h1>
          <p className="text-lg text-slate-700">Editor de documentos colaborativos para aulas, projetos e gestao academica.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-slate-900">O que o KnexDocs resolve</h2>
          <p className="text-base text-slate-700">Centraliza textos e pautas em uma base unica, com revisao simples e links para outros apps.</p>
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
