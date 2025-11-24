import Link from "next/link";

export default function VioStudioPage() {
  const problems = [
    "Editar videos de aulas sem depender de softwares complexos.",
    "Adicionar cortes, legendas e ajustes simples antes de publicar.",
    "Manter um fluxo continuo de gravacao (VioRecord) para edicao e publicacao.",
  ];

  const features = [
    "Estrategias rapidas de cortes, uniao de clipes e ajustes basicos.",
    "Legendas simples e ajustes de audio para clareza.",
    "Exportar direto para VioClass, SupaDrive ou compartilhamento via link.",
    "Presets padronizados para manter identidade visual de cursos.",
  ];

  const audiences = ["Criadores de conteudo educacional", "Professores que gravam aulas", "Equipes de midia e edicao leve"];

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-12 space-y-10">
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Produto</p>
          <h1 className="text-3xl md:text-4xl font-bold">VioStudio</h1>
          <p className="text-lg text-slate-700">Edicao online de video para aulas, com passos simples e integracao ao restante da suite.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-slate-900">O que o VioStudio resolve</h2>
          <p className="text-base text-slate-700">Permite polir rapidamente videos gravados antes de publicar para alunos.</p>
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
          <h2 className="text-2xl font-semibold text-slate-900">Para quem e</h2>
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
