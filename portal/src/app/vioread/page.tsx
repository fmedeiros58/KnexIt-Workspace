import Link from "next/link";

export default function VioReadPage() {
  const problems = [
    "Ler artigos e PDFs longos sem apoio para traducao ou resumo.",
    "Manter estrutura do documento ao traduzir para outro idioma.",
    "Reaproveitar trechos para fichamentos e materiais de aula.",
  ];

  const features = [
    "Leitura assistida preservando titulos, secoes e listas.",
    "Traducao com estrutura mantida e opcao lado a lado.",
    "Selecione trechos para pedir explicacao, resumo ou fichamento.",
    "Exportacao futura para KnexDocs, VioClass ou SupaDrive.",
  ];

  const audiences = ["Alunos e pesquisadores", "Professores e orientadores", "Grupos de estudo e labs"];

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-12 space-y-10">
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Produto</p>
          <h1 className="text-3xl md:text-4xl font-bold">VioRead</h1>
          <p className="text-lg text-slate-700">Leitura inteligente de PDFs e artigos, com traducao e apoio de IA para estudo.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-slate-900">O que o VioRead resolve</h2>
          <p className="text-base text-slate-700">Ajuda a compreender textos tecnicos, mantendo estrutura e permitindo consultas rapidas.</p>
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
