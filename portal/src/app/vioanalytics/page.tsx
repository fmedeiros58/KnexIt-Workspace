import Link from "next/link";

export default function VioAnalyticsPage() {
  const problems = [
    "Entender engajamento real das videoaulas e lives.",
    "Saber quais conteudos retiveram melhor atencao ou causaram abandono.",
    "Tomar decisoes sobre revisao de materiais e turmas baseadas em dados.",
  ];

  const features = [
    "Metricas de visualizacao, tempo assistido e pontos de queda.",
    "Comparacao de desempenho por aula, turma ou serie.",
    "Indicadores de engajamento para orientar revisoes de conteudo.",
    "Alertas simples para aulas com baixa aderencia.",
  ];

  const audiences = ["Coordenacao pedagogica", "Professores e tutores", "Equipes de dados ou BI educacional"];

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-12 space-y-10">
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Produto</p>
          <h1 className="text-3xl md:text-4xl font-bold">VioAnalytics</h1>
          <p className="text-lg text-slate-700">
            Analise de visualizacao e engajamento em videos e lives para orientar decisoes pedagogicas e editoriais.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-slate-900">O que o VioAnalytics resolve</h2>
          <p className="text-base text-slate-700">Mostra como os alunos consomem aulas e onde melhorar materiais e formato.</p>
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
