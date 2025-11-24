import Link from "next/link";

export default function KnexAiPage() {
  const problems = [
    "Ter assistentes de IA espalhados sem controle de uso ou contexto.",
    "Dificuldade de conectar IA aos dados certos (aulas, arquivos, pesquisas).",
    "Falta de padrao para limites e politicas por plano.",
  ];

  const features = [
    "Camada unificada de IA para os apps da suite.",
    "Assistentes configuraveis com contexto de aulas, arquivos e pesquisas.",
    "Limites e governanca alinhados aos planos do Workspace.",
    "Pontos de integracao com VioRead, KnexReview e KnexSearch.",
  ];

  const audiences = ["Equipes academicas que querem IA segura", "Professores e pesquisadores", "Administradores da suite"];

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-12 space-y-10">
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Produto</p>
          <h1 className="text-3xl md:text-4xl font-bold">KnexAI</h1>
          <p className="text-lg text-slate-700">Camada unificada de IA para leitura, revisao, busca e assistentes conectados aos seus dados.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-slate-900">O que o KnexAI resolve</h2>
          <p className="text-base text-slate-700">Centraliza e governa o uso de IA, evitando dispersao e falta de contexto.</p>
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
