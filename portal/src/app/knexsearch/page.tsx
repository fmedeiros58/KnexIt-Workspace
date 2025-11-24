import Link from "next/link";

export default function KnexSearchPage() {
  const problems = [
    "Perder tempo procurando aulas, arquivos ou mensagens em varios lugares.",
    "Nao conseguir recuperar rapidamente conteudos criticos para uma turma.",
    "Falta de busca unificada com contexto de quem pode acessar o que.",
  ];

  const features = [
    "Busca global em aulas, arquivos e mensagens (quando habilitado).",
    "Filtros por tipo de conteudo, turma ou data.",
    "IA para sugerir resultados relevantes e resumos curtos.",
    "Suporte a permissoes: cada usuario ve apenas o que pode acessar.",
  ];

  const audiences = ["Professores e coordenacao", "Alunos que precisam rever conteudos", "Equipes administrativas"];

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-12 space-y-10">
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Produto</p>
          <h1 className="text-3xl md:text-4xl font-bold">KnexSearch</h1>
          <p className="text-lg text-slate-700">
            Busca inteligente com IA para localizar aulas, arquivos, mensagens e conteudos da suite em segundos.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-slate-900">O que o KnexSearch resolve</h2>
          <p className="text-base text-slate-700">Traz um ponto unico de busca, com contexto e permissoes respeitadas.</p>
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
