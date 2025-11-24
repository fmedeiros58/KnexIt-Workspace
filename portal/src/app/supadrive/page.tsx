import Link from "next/link";

export default function SupaDrivePage() {
  const problems = [
    "Organizar apostilas, provas e slides sem perder versao.",
    "Compartilhar materiais com turmas e times com controle de acesso.",
    "Centralizar uploads e manter estrutura clara por curso ou projeto.",
  ];

  const features = [
    "Pastas por curso, turma ou projeto com permissao configuravel.",
    "Upload de PDFs, slides, docs e midias com visualizacao rapida.",
    "Versoes e comentarios basicos para alinhar revisoes.",
    "Integracao futura com VioRead e KnexReview para leitura assistida.",
  ];

  const audiences = ["Professores e equipes pedagógicas", "Alunos e monitores", "Laboratorios e grupos de pesquisa"];

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-12 space-y-10">
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Produto</p>
          <h1 className="text-3xl md:text-4xl font-bold">SupaDrive</h1>
          <p className="text-lg text-slate-700">
            Drive de arquivos da suite para guardar e distribuir materiais de aula, pesquisa e projetos.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-slate-900">O que o SupaDrive resolve</h2>
          <p className="text-base text-slate-700">Centraliza materiais com controle de acesso e estrutura clara por turma ou grupo.</p>
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
